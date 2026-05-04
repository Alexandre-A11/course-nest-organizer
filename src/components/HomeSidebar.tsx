import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ArrowRight, Flame } from "lucide-react";
import { getDB } from "@/lib/db";
import type { Course, CourseFileMeta } from "@/lib/db";
import { getCategory } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";
import { computeStreak } from "@/lib/streak";

function htmlToPlain(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ").trim();
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? "").trim();
}

interface NoteRow {
  fileId: string;
  courseId: string;
  courseName: string;
  category?: string;
  title: string;
  preview: string;
  updatedAt: number;
}

interface Props {
  courses: Course[];
  filesByCourse: Record<string, CourseFileMeta[]>;
}

export function HomeSidebar({ courses, filesByCourse }: Props) {
  const { t } = useI18n();
  const [notes, setNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDB();
      const allFiles = await db.getAll("files");
      if (cancelled) return;
      const cmap = new Map(courses.map((c) => [c.id, c]));
      const rows: NoteRow[] = allFiles
        .filter((f) => typeof f.comment === "string" && f.comment.trim().length > 0)
        .map((f) => {
          const c = cmap.get(f.courseId);
          const plain = htmlToPlain(f.comment as string);
          // Use first non-empty line as title.
          const lines = plain.split(/\n+/).map((s) => s.trim()).filter(Boolean);
          const title = lines[0] ?? f.name;
          const rest = lines.slice(1).join(" ") || plain.slice(title.length).trim();
          return {
            fileId: f.id,
            courseId: f.courseId,
            courseName: c?.name ?? "—",
            category: c?.category,
            title: title.slice(0, 80),
            preview: rest.slice(0, 110),
            updatedAt: f.updatedAt ?? 0,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 3);
      setNotes(rows);
    })();
    return () => { cancelled = true; };
  }, [courses]);

  const streak = useMemo(
    () => computeStreak(courses, filesByCourse),
    [courses, filesByCourse],
  );

  return (
    <aside className="flex w-full flex-col gap-6">
      {/* Notas Recentes */}
      <section className="rounded-3xl border border-border/40 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <header className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-foreground/70" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("sidebar.recentNotes")}
            </h2>
          </div>
          <Link
            to="/notes"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={t("sidebar.allNotes")}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        {notes.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {t("sidebar.noNotes")}
          </p>
        ) : (
          <ul className="space-y-5">
            {notes.map((n) => {
              const cat = getCategory(n.category);
              const dot = cat ? cat.color.replace("text-", "bg-") : "bg-muted-foreground/40";
              return (
                <li key={n.fileId}>
                  <Link
                    to="/course/$courseId"
                    params={{ courseId: n.courseId }}
                    className="block group"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {n.courseName}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">
                      {n.title}
                    </h3>
                    {n.preview && (
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {n.preview}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {notes.length > 0 && (
          <Link
            to="/notes"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t("sidebar.openNotebook")}
          </Link>
        )}
      </section>

      {/* Ofensiva (streak) */}
      <section className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-rose-100 via-amber-100 to-yellow-100 p-6 shadow-sm dark:from-rose-950/40 dark:via-amber-950/30 dark:to-yellow-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-rose-500 shadow-sm dark:bg-white/10">
            <Flame className="h-5 w-5 fill-current" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              {t("sidebar.streakTitle", { n: streak })}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-foreground/70">
              {t("sidebar.streakSubtitle")}
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}