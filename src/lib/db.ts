import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type FileKind = "video" | "pdf" | "audio" | "doc" | "image" | "other";

export interface CourseFileMeta {
  id: string; // courseId + relative path
  courseId: string;
  path: string; // relative path inside course folder
  name: string;
  kind: FileKind;
  size: number;
  watched: boolean;
  watchedAt?: number;
  comment?: string;
  /** For videos/audio: last currentTime in SECONDS where the user paused. */
  progress?: number;
  /** Last local mutation timestamp (ms). Used by the sync layer. */
  updatedAt?: number;
}

/**
 * A code snapshot belonging to a specific lesson file. Each video/document can
 * accumulate its own history of code blocks captured while studying. Snapshots
 * are synced via the standard last-write-wins layer and surfaced both in the
 * file viewer (Code tab) and in the global /notes dashboard.
 */
export interface CodeSnapshot {
  id: string;             // ulid-ish: `${fileId}:${createdAt}:${rand}`
  fileId: string;         // CourseFileMeta.id
  courseId: string;
  /** Highlight.js language name — js, ts, tsx, python, java, rust, dockerfile… */
  language: string;
  code: string;
  /** Optional short label ("Component skeleton", "Final hook"). */
  title?: string;
  createdAt: number;
  updatedAt?: number;
  /** Tombstone flag — soft-deleted snapshots are kept for sync propagation. */
  deleted?: boolean;
}

export interface Course {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  /**
   * Course Vault is now a fully remote app — every course streams from a
   * self-hosted Course Vault server (HTTP Range). The legacy `handle`,
   * `memory` and `cached` sources have been removed; the type is kept as a
   * union for backward-compat in older IndexedDB rows so we can detect &
   * purge them on first boot. New courses are always `"remote"`.
   */
  source: "remote" | "handle" | "memory" | "cached";
  /** Legacy: native FSA handle. Never written by new code; only read for purge. */
  handle?: FileSystemDirectoryHandle;
  /** Legacy: original folder name (memory mode). Only read for purge. */
  rootName?: string;
  /** For "remote" sources: folder name inside the server's COURSES_DIR. */
  remoteFolder?: string;
  color: string; // accent color seed
  // Optional category id (see src/lib/categories.ts)
  category?: string;
  // Optional banner image stored as a data URL (kept inline so it survives
  // export/sync without separate blob storage).
  banner?: string;
  // Last file the user opened in this course, used by the "Continue where
  // you left off" feature on the home page.
  lastFileId?: string;
  lastAccessedAt?: number;
  /**
   * Custom user-defined ordering (drag & drop) for files and folders inside
   * this course. Maps a relative path (file or folder) → numeric orderIndex.
   * Items without an entry fall back to natural alphanumeric ordering.
   */
  customOrder?: Record<string, number>;
  /** Persisted FileTree UI state — restored when the user reopens the course. */
  expandedFolders?: string[];
  /** Folder currently focused in the tree (Show only this folder). */
  focusedFolder?: string | null;
  /** "natural" = A→Z natural sort; "reverse" = Z→A; "progress" = unwatched first. */
  sortMode?: "natural" | "reverse" | "progress";
  /** When true, the FileTree shows a flattened, type-grouped list. */
  flattenFolders?: boolean;
  /** Last local mutation timestamp (ms). Used by the sync layer. */
  updatedAt?: number;
}

interface Schema extends DBSchema {
  courses: {
    key: string;
    value: Course;
  };
  files: {
    key: string;
    value: CourseFileMeta;
    indexes: { byCourse: string };
  };
  fileBlobs: {
    key: string; // same as files.id
    value: { id: string; courseId: string; blob: Blob };
    indexes: { byCourse: string };
  };
  snapshots: {
    key: string;
    value: CodeSnapshot;
    indexes: { byFile: string; byCourse: string };
  };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DB only available in the browser"));
  }
  if (!dbPromise) {
    dbPromise = openDB<Schema>("course-vault", 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("courses", { keyPath: "id" });
          const files = db.createObjectStore("files", { keyPath: "id" });
          files.createIndex("byCourse", "courseId");
        }
        if (oldVersion < 2) {
          const blobs = db.createObjectStore("fileBlobs", { keyPath: "id" });
          blobs.createIndex("byCourse", "courseId");
        }
        if (oldVersion < 3) {
          const snaps = db.createObjectStore("snapshots", { keyPath: "id" });
          snaps.createIndex("byFile", "fileId");
          snaps.createIndex("byCourse", "courseId");
        }
      },
    });
  }
  return dbPromise;
}

export async function listCourses(): Promise<Course[]> {
  const db = await getDB();
  const all = await db.getAll("courses");
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCourse(id: string) {
  const db = await getDB();
  return db.get("courses", id);
}

export async function saveCourse(course: Course) {
  const db = await getDB();
  await db.put("courses", { ...course, updatedAt: Date.now() });
}

export async function deleteCourse(id: string) {
  const db = await getDB();
  await db.delete("courses", id);
  const tx = db.transaction("files", "readwrite");
  const idx = tx.store.index("byCourse");
  let cursor = await idx.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
  // Also clear blobs
  const tx2 = db.transaction("fileBlobs", "readwrite");
  const idx2 = tx2.store.index("byCourse");
  let c2 = await idx2.openCursor(id);
  while (c2) {
    await c2.delete();
    c2 = await c2.continue();
  }
  await tx2.done;
  // Remember the deletion so sync can propagate it.
  rememberDeletedCourse(id);
}

export async function listFiles(courseId: string): Promise<CourseFileMeta[]> {
  const db = await getDB();
  return db.getAllFromIndex("files", "byCourse", courseId);
}

export async function getFileMeta(id: string) {
  const db = await getDB();
  return db.get("files", id);
}

export async function upsertFile(meta: CourseFileMeta) {
  const db = await getDB();
  await db.put("files", { ...meta, updatedAt: Date.now() });
}

export async function upsertFiles(metas: CourseFileMeta[]) {
  const db = await getDB();
  const tx = db.transaction("files", "readwrite");
  const now = Date.now();
  await Promise.all(metas.map((m) => tx.store.put({ ...m, updatedAt: now })));
  await tx.done;
}

// ---- Cached blob storage ----

export async function putFileBlob(id: string, courseId: string, blob: Blob) {
  const db = await getDB();
  await db.put("fileBlobs", { id, courseId, blob });
}

export async function putFileBlobs(entries: { id: string; courseId: string; blob: Blob }[]) {
  const db = await getDB();
  const tx = db.transaction("fileBlobs", "readwrite");
  await Promise.all(entries.map((e) => tx.store.put(e)));
  await tx.done;
}

export async function getFileBlob(id: string): Promise<Blob | undefined> {
  const db = await getDB();
  const rec = await db.get("fileBlobs", id);
  return rec?.blob;
}

export async function deleteCourseBlobs(courseId: string) {
  const db = await getDB();
  const tx = db.transaction("fileBlobs", "readwrite");
  const idx = tx.store.index("byCourse");
  let cursor = await idx.openCursor(courseId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

/**
 * Wipe progress for a course: clears `watched`, `watchedAt`, `progress` and
 * (optionally) `comment` for every file. Files themselves are not removed
 * from the index. Also clears the lastFileId pointer on the course.
 *
 * @param keepNotes when true, preserves each file's `comment` field.
 */
export async function resetCourseProgress(courseId: string, keepNotes = false) {
  const db = await getDB();
  const tx = db.transaction(["files", "courses"], "readwrite");
  const filesStore = tx.objectStore("files");
  const idx = filesStore.index("byCourse");
  let cursor = await idx.openCursor(courseId);
  const now = Date.now();
  while (cursor) {
    const f = cursor.value as CourseFileMeta;
    await cursor.update({
      ...f,
      watched: false,
      watchedAt: undefined,
      progress: undefined,
      comment: keepNotes ? f.comment : undefined,
      updatedAt: now,
    });
    cursor = await cursor.continue();
  }
  const c = await tx.objectStore("courses").get(courseId);
  if (c) {
    await tx.objectStore("courses").put({
      ...c, lastFileId: undefined, lastAccessedAt: undefined, updatedAt: now,
    });
  }
  await tx.done;
}

/** Update the "last opened file" pointer on a course. */
export async function touchCourseLastFile(courseId: string, fileId: string) {
  const db = await getDB();
  const c = await db.get("courses", courseId);
  if (!c) return;
  const now = Date.now();
  await db.put("courses", { ...c, lastFileId: fileId, lastAccessedAt: now, updatedAt: now });
}

/** Persist the current playback position for a media file (in seconds). */
export async function saveFileProgress(fileId: string, seconds: number) {
  const db = await getDB();
  const f = await db.get("files", fileId);
  if (!f) return;
  await db.put("files", { ...f, progress: seconds, updatedAt: Date.now() });
}

// ---- Deletion log (so sync can propagate removals) ----

/**
 * Tombstones for deleted courses. We persist BOTH the id and a deletion
 * timestamp so the sync layer can authoritatively propagate removals across
 * clients (last-write-wins on the server). Tombstones are kept locally even
 * after sync so any peer that comes online later still receives them — until
 * we observe the server has fully removed the row (handled in syncClient).
 */
const DELETED_COURSES_KEY = "course-vault.deletedCourses";

export type DeletedCourseEntry = { id: string; deletedAt: number };

function loadDeletedCourses(): Map<string, number> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(DELETED_COURSES_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    // Back-compat: previously a string[] of ids.
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      const m = new Map<string, number>();
      const now = Date.now();
      for (const id of parsed) m.set(id, now);
      return m;
    }
    if (Array.isArray(parsed)) {
      const m = new Map<string, number>();
      for (const e of parsed as DeletedCourseEntry[]) {
        if (e && typeof e.id === "string") m.set(e.id, Number(e.deletedAt) || Date.now());
      }
      return m;
    }
    return new Map();
  } catch { return new Map(); }
}
function saveDeletedCourses(map: Map<string, number>) {
  if (typeof window === "undefined") return;
  try {
    const arr: DeletedCourseEntry[] = [...map.entries()].map(([id, deletedAt]) => ({ id, deletedAt }));
    window.localStorage.setItem(DELETED_COURSES_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}
export function rememberDeletedCourse(id: string, when: number = Date.now()) {
  const s = loadDeletedCourses();
  s.set(id, when);
  saveDeletedCourses(s);
}
export function getDeletedCourseIds(): string[] {
  return [...loadDeletedCourses().keys()];
}
export function getDeletedCourseEntries(): DeletedCourseEntry[] {
  return [...loadDeletedCourses().entries()].map(([id, deletedAt]) => ({ id, deletedAt }));
}
export function clearDeletedCourses(ids: string[]) {
  const s = loadDeletedCourses();
  for (const id of ids) s.delete(id);
  saveDeletedCourses(s);
}

/**
 * Bulk update the `watched` (+ `watchedAt`) flag on multiple files at once.
 * Used by the FileTree multi-select bulk actions.
 */
export async function bulkSetWatched(fileIds: string[], watched: boolean): Promise<CourseFileMeta[]> {
  if (fileIds.length === 0) return [];
  const db = await getDB();
  const tx = db.transaction("files", "readwrite");
  const now = Date.now();
  const updated: CourseFileMeta[] = [];
  for (const id of fileIds) {
    const f = (await tx.store.get(id)) as CourseFileMeta | undefined;
    if (!f) continue;
    const next: CourseFileMeta = {
      ...f,
      watched,
      watchedAt: watched ? now : undefined,
      updatedAt: now,
    };
    await tx.store.put(next);
    updated.push(next);
  }
  await tx.done;
  return updated;
}

/** Persist FileTree UI state for a course. */
export async function saveCourseUiState(
  courseId: string,
  patch: Partial<Pick<Course, "expandedFolders" | "focusedFolder" | "sortMode" | "flattenFolders">>,
) {
  const db = await getDB();
  const c = await db.get("courses", courseId);
  if (!c) return;
  await db.put("courses", { ...c, ...patch, updatedAt: Date.now() });
}

/** Legacy: persist a custom drag-and-drop order map for a course. */
export async function saveCourseCustomOrder(courseId: string, order: Record<string, number>) {
  const db = await getDB();
  const c = await db.get("courses", courseId);
  if (!c) return;
  await db.put("courses", { ...c, customOrder: order, updatedAt: Date.now() });
}

/**
 * One-shot migration helper called at app boot. Deletes every course that
 * was added with a now-removed local source (`handle`, `memory`, `cached`)
 * along with its files & blobs. Returns the names of removed courses so the
 * UI can show a one-time toast.
 */
export async function purgeLegacyLocalCourses(): Promise<string[]> {
  const db = await getDB();
  const all = await db.getAll("courses");
  const toDelete = all.filter((c) => c.source !== "remote");
  if (toDelete.length === 0) return [];
  for (const c of toDelete) {
    await deleteCourse(c.id); // already wipes files + blobs + tombstone
  }
  return toDelete.map((c) => c.name);
}

// ---- Library export / import (JSON) ----

export interface LibraryBackupV1 {
  version: 1;
  exportedAt: number;
  courses: Array<Omit<Course, "handle"> & { handle?: undefined }>;
  files: CourseFileMeta[];
  customCategories: unknown; // shape owned by categories.ts
  removedBuiltins: string[];
}

/** Build a JSON-serializable snapshot of the entire library (no blobs/handles). */
export async function exportLibrary(extra: {
  customCategories: unknown;
  removedBuiltins: string[];
}): Promise<LibraryBackupV1> {
  const db = await getDB();
  const courses = await db.getAll("courses");
  const files = await db.getAll("files");
  // Strip non-serializable fields (FileSystemDirectoryHandle).
  const sanitizedCourses = courses.map((c) => {
    const { handle: _h, ...rest } = c;
    void _h;
    return { ...rest, handle: undefined };
  });
  return {
    version: 1,
    exportedAt: Date.now(),
    courses: sanitizedCourses,
    files,
    customCategories: extra.customCategories,
    removedBuiltins: extra.removedBuiltins,
  };
}

/** Merge an imported backup into the local DB. Returns number of courses imported. */
export async function importLibrary(backup: LibraryBackupV1): Promise<number> {
  if (!backup || backup.version !== 1) throw new Error("Unsupported backup version");
  const db = await getDB();
  const tx = db.transaction(["courses", "files"], "readwrite");
  for (const c of backup.courses) {
    // Imported courses lose their FSA handle and any RAM-only file map.
    // Force them into "memory" mode so the user is prompted to re-pick the
    // folder on first open in this browser.
    const incoming: Course = {
      ...c,
      handle: undefined,
      source: c.source === "cached" ? "cached" : "memory",
    } as Course;
    await tx.objectStore("courses").put(incoming);
  }
  for (const f of backup.files) {
    await tx.objectStore("files").put(f);
  }
  await tx.done;
  return backup.courses.length;
}