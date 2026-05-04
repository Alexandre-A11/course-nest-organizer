import type { Course, CourseFileMeta } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute current activity streak (consecutive days with at least one
 * course access). Uses lastAccessedAt on courses and watchedAt on files.
 */
export function computeStreak(
  courses: Course[],
  filesByCourse: Record<string, CourseFileMeta[]>,
): number {
  const days = new Set<string>();
  const push = (ts?: number) => {
    if (!ts) return;
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  };
  for (const c of courses) push(c.lastAccessedAt);
  for (const list of Object.values(filesByCourse)) {
    for (const f of list) push(f.watchedAt);
  }
  if (days.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  // Allow up to 1 day grace: if yesterday counted but not today, streak still alive.
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) streak++;
    else if (i === 0) continue; // today missing — keep checking
    else break;
  }
  return streak;
}