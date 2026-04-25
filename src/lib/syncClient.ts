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
  getDeletedCourseIds, clearDeletedCourses,
} from "@/lib/db";
import {
  getCustomCategoriesRaw, getRemovedBuiltinIds, importCategoryState,
} from "@/lib/categories";

const URL_KEY = "course-vault.serverUrl";
const LAST_SYNC_KEY = "course-vault.lastSyncAt";

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
  return window.localStorage.getItem(URL_KEY);
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
}

async function applyRemoteSnapshot(snap: ServerSnapshot) {
  const db = await getDB();
  const tx = db.transaction(["courses", "files"], "readwrite");
  const cstore = tx.objectStore("courses");
  const fstore = tx.objectStore("files");
  for (const remote of snap.courses) {
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

export async function listServerFolders(): Promise<{ name: string }[]> {
  const url = getServerUrl();
  if (!url) throw new Error("no server");
  const res = await fetch(`${url}/folders`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { folders: { name: string }[] };
  return data.folders;
}

export async function scanServerFolder(folder: string): Promise<{ files: { path: string; name: string; size: number; kind: string }[] }> {
  const url = getServerUrl();
  if (!url) throw new Error("no server");
  const res = await fetch(`${url}/folders/${encodeURIComponent(folder)}/scan`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Build a streaming URL for a remote file. */
export function streamUrlFor(folder: string, relPath: string): string | null {
  const url = getServerUrl();
  if (!url) return null;
  const parts = relPath.split("/").map(encodeURIComponent).join("/");
  return `${url}/stream/${encodeURIComponent(folder)}/${parts}`;
}

// Auto-start on module load (browser only).
if (typeof window !== "undefined" && getServerUrl()) {
  // Defer to next tick so React has a chance to mount listeners.
  setTimeout(() => { startPolling(); void syncOnce(); }, 100);
}