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
  // Source can be either a File System Access API directory handle (Chromium)
  // or "memory" for browsers that only support <input webkitdirectory> (Firefox/Safari).
  // When "memory", the user must reselect the folder each session.
  source: "handle" | "memory";
  // Native handle (only present in Chromium-based browsers)
  handle?: FileSystemDirectoryHandle;
  // For "memory" sources we store the original folder name for re-matching
  rootName?: string;
  color: string; // accent color seed
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
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DB only available in the browser"));
  }
  if (!dbPromise) {
    dbPromise = openDB<Schema>("course-vault", 1, {
      upgrade(db) {
        db.createObjectStore("courses", { keyPath: "id" });
        const files = db.createObjectStore("files", { keyPath: "id" });
        files.createIndex("byCourse", "courseId");
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