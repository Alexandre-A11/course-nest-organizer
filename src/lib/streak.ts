import type { Course, CourseFileMeta } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute the current activity streak — consecutive days where the user
 * explicitly completed at least one lesson (file marked as watched). Just
 * opening the app or a course does NOT count: only `watchedAt` on files.
 */
export function computeStreak(
  _courses: Course[],
  filesByCourse: Record<string, CourseFileMeta[]>,
): number {
  const days = new Set<string>();
  const push = (ts?: number) => {
    if (!ts) return;
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  };
  for (const list of Object.values(filesByCourse)) {
    for (const f of list) {
      if (f.watched) push(f.watchedAt);
    }
  }
  if (days.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) streak++;
    else if (i === 0) continue; // grace: today not yet counted
    else break;
  }
  return streak;
}