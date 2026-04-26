/**
 * Optional self-hosted LAN sync client for Course Vault.
 *
 * - The server URL is persisted in localStorage. When set, the app pulls a
 *   snapshot on startup and pushes a diff every few seconds.
 * - Conflict resolution is last-write-wins on each row, using the
 *   `updatedAt` timestamp stamped by the IDB helpers in db.ts.
 * - All work is best-effort: if the server is offline, the app keeps using
 *   local IndexedDB and resyncs on the next successful poll.
 */
import {
  getDB, type Course, type CourseFileMeta,
  getDeletedCourseEntries, getDeletedCourseIds, clearDeletedCourses,
  rememberDeletedCourse,
} from "@/lib/db";
import {
  getCustomCategoriesRaw, getRemovedBuiltinIds, importCategoryState,
} from "@/lib/categories";

const URL_KEY = "course-vault.serverUrl";
const LAST_SYNC_KEY = "course-vault.lastSyncAt";
/**
 * When the web app is being served from the Course Vault server itself
 * (single-container Docker deploy), we auto-use the same origin as the API.
 * This is detected by probing /health on window.location.origin at startup.
 */
const AUTO_DETECTED_KEY = "course-vault.autoServer";

export type SyncStatus = "disabled" | "online" | "offline" | "syncing";

type Listener = (s: SyncStatus, info: { lastSyncAt: number | null; url: string | null }) => void;
const listeners = new Set<Listener>();
let status: SyncStatus = "disabled";
let lastSyncAt: number | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;

function notify() {
  for (const l of listeners) l(status, { lastSyncAt, url: getServerUrl() });
}

export function getServerUrl(): string | null {
  if (typeof window === "undefined") return null;
  const explicit = window.localStorage.getItem(URL_KEY);
  if (explicit) return explicit;
  // Same-origin auto-detection (single-container deploy).
  return window.localStorage.getItem(AUTO_DETECTED_KEY);
}

/**
 * On startup, if we're not yet connected to a server, probe the current origin
 * for /health. If it responds, treat it as the server URL automatically — this
 * is the case when the user opens http://nas.local:8787 (Docker single-image).
 */
async function autoDetectSameOrigin(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(URL_KEY)) return; // user already chose
  if (window.localStorage.getItem(AUTO_DETECTED_KEY)) return; // already detected
  try {
    const origin = window.location.origin;
    // Don't probe on localhost dev (Vite) — the API isn't there.
    if (/^(http:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return;
    const res = await fetch(`${origin}/health`, { method: "GET" });
    if (!res.ok) return;
    const data = await res.json() as { ok?: boolean };
    if (!data.ok) return;
    window.localStorage.setItem(AUTO_DETECTED_KEY, origin);
    startPolling();
    void syncOnce();
  } catch { /* ignore — no server here */ }
}

export function getStatus(): SyncStatus { return status; }
export function getLastSyncAt(): number | null { return lastSyncAt; }

export function subscribeSync(cb: Listener): () => void {
  listeners.add(cb);
  cb(status, { lastSyncAt, url: getServerUrl() });
  return () => { listeners.delete(cb); };
}

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!u) return u;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  return u.replace(/\/+$/, "");
}

export async function testServer(rawUrl: string): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  const url = normalizeUrl(rawUrl);
  try {
    const res = await fetch(`${url}/health`, { method: "GET" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json() as { ok?: boolean; version?: string };
    if (!data.ok) return { ok: false, error: "invalid response" };
    return { ok: true, version: data.version ?? "?" };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function connectServer(rawUrl: string): Promise<void> {
  const url = normalizeUrl(rawUrl);
  if (typeof window !== "undefined") window.localStorage.setItem(URL_KEY, url);
  startPolling();
  await syncOnce(); // initial pull/push
}

export function disconnectServer(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(URL_KEY);
    window.localStorage.removeItem(AUTO_DETECTED_KEY);
    window.localStorage.removeItem(LAST_SYNC_KEY);
  }
  stopPolling();
  status = "disabled";
  lastSyncAt = null;
  notify();
}

export function startPolling() {
  if (typeof window === "undefined") return;
  if (!getServerUrl()) return;
  if (timer) return;
  status = "syncing";
  notify();
  // Resync on tab visibility return.
  window.addEventListener("visibilitychange", onVis);
  timer = setInterval(() => { void syncOnce(); }, 8000);
}

function stopPolling() {
  if (timer) { clearInterval(timer); timer = null; }
  if (typeof window !== "undefined") {
    window.removeEventListener("visibilitychange", onVis);
  }
}

function onVis() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") void syncOnce();
}

/** Build a list of local rows to push (those with updatedAt > lastSyncAt). */
async function collectLocalChanges(since: number) {
  const db = await getDB();
  const courses = (await db.getAll("courses")) as Course[];
  const files = (await db.getAll("files")) as CourseFileMeta[];
  const courseChanges = courses
    .filter((c) => (c.updatedAt ?? c.createdAt ?? 0) > since)
    .map((c) => {
      // Strip non-serializable / browser-local fields.
      const { handle: _h, ...rest } = c;
      void _h;
      return { ...rest, _updatedAt: c.updatedAt ?? c.createdAt ?? Date.now() };
    });
  const fileChanges = files
    .filter((f) => (f.updatedAt ?? 0) > since)
    .map((f) => ({ ...f, _updatedAt: f.updatedAt ?? Date.now() }));
  return { courseChanges, fileChanges };
}

interface ServerSnapshot {
  version: number;
  serverTime: number;
  courses: Array<Course & { _updatedAt: number }>;
  files: Array<CourseFileMeta & { _updatedAt: number }>;
  customCategories?: Array<{ id: string; name: string; iconName: string; color: string }>;
  removedBuiltins?: string[];
  /** Authoritative list of course ids the server has marked as deleted. */
  deletedCourses?: Array<{ id: string; deletedAt: number }>;
}

async function applyRemoteSnapshot(snap: ServerSnapshot) {
  const db = await getDB();
  const tx = db.transaction(["courses", "files"], "readwrite");
  const cstore = tx.objectStore("courses");
  const fstore = tx.objectStore("files");
  // 1) Apply remote tombstones FIRST so we don't reinsert a course we just
  //    learned was deleted on another client.
  const tombstoneIds = new Set<string>();
  if (Array.isArray(snap.deletedCourses)) {
    for (const t of snap.deletedCourses) {
      if (!t?.id) continue;
      tombstoneIds.add(t.id);
      // Remove the course locally (if present) and all its files.
      const local = (await cstore.get(t.id)) as Course | undefined;
      if (local) await cstore.delete(t.id);
      // Files for this course (cursor over the byCourse index).
      const idx = fstore.index("byCourse");
      let cursor = await idx.openCursor(t.id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      // Mirror the tombstone locally so this client also re-broadcasts it
      // on next sync (helps peers that were offline at deletion time).
      rememberDeletedCourse(t.id, t.deletedAt);
    }
  }
  for (const remote of snap.courses) {
    if (tombstoneIds.has(remote.id)) continue;
    const local = (await cstore.get(remote.id)) as Course | undefined;
    const localTs = local?.updatedAt ?? local?.createdAt ?? 0;
    if (!local || (remote._updatedAt ?? 0) > localTs) {
      const { _updatedAt, ...rest } = remote;
      // Preserve any local-only browser fields (handle is per-browser).
      const merged: Course = {
        ...rest,
        handle: local?.handle,
        // If the local browser already has this course as a non-remote source,
        // keep that source so we don't blow away its local FSA handle.
        source: local && local.source !== "remote" && rest.source === "remote"
          ? local.source
          : rest.source,
        updatedAt: _updatedAt,
      };
      await cstore.put(merged);
    }
  }
  for (const remote of snap.files) {
    if (tombstoneIds.has(remote.courseId)) continue;
    const local = (await fstore.get(remote.id)) as CourseFileMeta | undefined;
    const localTs = local?.updatedAt ?? 0;
    if (!local || (remote._updatedAt ?? 0) > localTs) {
      const { _updatedAt, ...rest } = remote;
      await fstore.put({ ...rest, updatedAt: _updatedAt });
    }
  }
  await tx.done;

  // Categories: server is authoritative when newer (we can't easily compare
  // here, so just trust the server snapshot if it contains the keys).
  if (snap.customCategories || snap.removedBuiltins) {
    importCategoryState({
      custom: snap.customCategories,
      removedBuiltins: snap.removedBuiltins,
    });
  }
}

export async function syncOnce(): Promise<void> {
  if (inflight) return inflight;
  const url = getServerUrl();
  if (!url) return;
  inflight = (async () => {
    status = "syncing"; notify();
    try {
      const since = lastSyncAt ?? Number(window.localStorage.getItem(LAST_SYNC_KEY) ?? "0");
      const { courseChanges, fileChanges } = await collectLocalChanges(since);
      const deletedCourses = getDeletedCourseIds();
      const body = {
        clientTime: Date.now(),
        courses: courseChanges,
        files: fileChanges,
        deletedCourses,
        customCategories: getCustomCategoriesRaw(),
        removedBuiltins: getRemovedBuiltinIds(),
      };
      const res = await fetch(`${url}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const snap = (await res.json()) as ServerSnapshot;
      await applyRemoteSnapshot(snap);
      clearDeletedCourses(deletedCourses);
      lastSyncAt = snap.serverTime ?? Date.now();
      window.localStorage.setItem(LAST_SYNC_KEY, String(lastSyncAt));
      status = "online";
      notify();
      // Notify any UI subscribers that data changed.
      window.dispatchEvent(new CustomEvent("course-vault:synced"));
    } catch (err) {
      status = "offline";
      notify();
      // Don't spam console; surface only at debug.
      console.debug("[sync] failed:", (err as Error).message);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ---- Server folder browsing (used by AddCourseDialog) ----

export interface RemoteFolder {
  name: string;
  /** Path relative to COURSES_DIR (e.g. "Math/Calc1"). */
  path: string;
  hasChildren: boolean;
}

/** List direct children of `parent` (or COURSES_DIR root when omitted). */
export async function listServerFolders(parent?: string): Promise<RemoteFolder[]> {
  const url = getServerUrl();
  if (!url) throw new Error("no server");
  const qs = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  const res = await fetch(`${url}/folders${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { folders: RemoteFolder[] };
  // Older servers (pre-subfolder) returned { name } only; backfill.
  return data.folders.map((f) => ({
    name: f.name,
    path: f.path ?? f.name,
    hasChildren: !!f.hasChildren,
  }));
}

export async function scanServerFolder(folderPath: string): Promise<{ files: { path: string; name: string; size: number; kind: string }[] }> {
  const url = getServerUrl();
  if (!url) throw new Error("no server");
  // Use the splat endpoint that supports nested paths; URL-encode each segment.
  const encoded = folderPath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${url}/folders-scan/${encoded}`);
  if (res.ok) return res.json();
  // Fallback for legacy single-segment scan endpoint.
  const legacy = await fetch(`${url}/folders/${encodeURIComponent(folderPath)}/scan`);
  if (!legacy.ok) throw new Error(`HTTP ${legacy.status}`);
  return legacy.json();
}

/** Build a streaming URL for a remote file. */
export function streamUrlFor(folder: string, relPath: string): string | null {
  const url = getServerUrl();
  if (!url) return null;
  const parts = relPath.split("/").map(encodeURIComponent).join("/");
  // Folder may itself contain "/" — encode the WHOLE path as one segment.
  return `${url}/stream/${encodeURIComponent(folder)}/${parts}`;
}

// Auto-start on module load (browser only).
if (typeof window !== "undefined") {
  // Defer to next tick so React has a chance to mount listeners.
  setTimeout(() => {
    if (getServerUrl()) {
      startPolling();
      void syncOnce();
    } else {
      void autoDetectSameOrigin();
    }
  }, 100);
}