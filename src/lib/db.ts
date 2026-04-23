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
  progress?: number; // 0..1 for videos
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
  source: "handle" | "memory" | "cached";
  // Native handle (only present in Chromium-based browsers)
  handle?: FileSystemDirectoryHandle;
  // For "memory" sources we store the original folder name for re-matching
  rootName?: string;
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
  await db.put("courses", course);
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
  await db.put("files", meta);
}

export async function upsertFiles(metas: CourseFileMeta[]) {
  const db = await getDB();
  const tx = db.transaction("files", "readwrite");
  await Promise.all(metas.map((m) => tx.store.put(m)));
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