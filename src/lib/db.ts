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

export interface Course {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  // Source can be:
  //  - "handle": File System Access API directory handle (Chromium). Survives
  //    reload but may need re-permission on each session.
  //  - "memory": user picked via <input webkitdirectory>. Files only live in
  //    RAM for this session unless `cached: true`.
  //  - "cached": files are stored as Blobs inside IndexedDB (see fileBlobs
  //    store). Works fully offline across sessions, no re-pick needed.
  //  - "remote": files live on a self-hosted Course Vault server and are
  //    streamed via HTTP. `remoteFolder` is the folder name on the server.
  source: "handle" | "memory" | "cached" | "remote";
  // Native handle (only present in Chromium-based browsers)
  handle?: FileSystemDirectoryHandle;
  // For "memory" sources we store the original folder name for re-matching
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
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DB only available in the browser"));
  }
  if (!dbPromise) {
    dbPromise = openDB<Schema>("course-vault", 2, {
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
 * `comment` for every file. Files themselves are not removed from the index.
 * Also clears the lastFileId pointer on the course.
 */
export async function resetCourseProgress(courseId: string) {
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
      comment: undefined,
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

const DELETED_COURSES_KEY = "course-vault.deletedCourses";

function loadDeletedCourses(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_COURSES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function saveDeletedCourses(set: Set<string>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(DELETED_COURSES_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}
export function rememberDeletedCourse(id: string) {
  const s = loadDeletedCourses();
  s.add(id);
  saveDeletedCourses(s);
}
export function getDeletedCourseIds(): string[] {
  return [...loadDeletedCourses()];
}
export function clearDeletedCourses(ids: string[]) {
  const s = loadDeletedCourses();
  for (const id of ids) s.delete(id);
  saveDeletedCourses(s);
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