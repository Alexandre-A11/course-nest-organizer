/**
 * In-memory cache of File objects for courses that were loaded via
 * <input webkitdirectory> (Firefox/Safari fallback).
 *
 * These do NOT persist across page reloads — the user must re-pick the
 * folder each session. The progress and comments stay saved in IndexedDB.
 */
const cache = new Map<string, Map<string, File>>();

export function setCourseFiles(courseId: string, files: Map<string, File>) {
  cache.set(courseId, files);
}

export function getCourseFiles(courseId: string): Map<string, File> | undefined {
  return cache.get(courseId);
}

export function hasCourseFiles(courseId: string): boolean {
  return cache.has(courseId);
}

export function clearCourseFiles(courseId: string) {
  cache.delete(courseId);
}