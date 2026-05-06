import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ArrowRight, Flame, ChevronLeft, ChevronRight, Code2 } from "lucide-react";
import { getDB } from "@/lib/db";
import type { Course, CourseFileMeta, CodeSnapshot } from "@/lib/db";
import { getCategory } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";
import { computeStreak } from "@/lib/streak";
import { languageLabel } from "@/lib/highlight";

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

interface CodeRow {
  id: string;
  courseId: string;
  courseName: string;
  category?: string;
  title: string;
  language: string;
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
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [tab, setTab] = useState<"notes" | "codes">("notes");
  const pausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDB();
      const allFiles = await db.getAll("files");
      const allSnaps = (await db.getAll("snapshots")).filter((s: CodeSnapshot) => !s.deleted);
      if (cancelled) return;
      const cmap = new Map(courses.map((c) => [c.id, c]));
      const noteRows: NoteRow[] = allFiles
        .filter((f) => typeof f.comment === "string" && f.comment.trim().length > 0)
        .map((f) => {
          const c = cmap.get(f.courseId);
          const plain = htmlToPlain(f.comment as string);
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
      const codeRows: CodeRow[] = allSnaps
        .map((s) => {
          const c = cmap.get(s.courseId);
          const firstLine = s.code.split("\n").find((l) => l.trim().length > 0) ?? "";
          return {
            id: s.id,
            courseId: s.courseId,
            courseName: c?.name ?? "—",
            category: c?.category,
            title: s.title?.trim() || firstLine.slice(0, 80) || languageLabel(s.language),
            language: s.language,
            preview: firstLine.slice(0, 110),
            updatedAt: s.updatedAt ?? s.createdAt,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 3);
      setNotes(noteRows);
      setCodes(codeRows);
    })();
    return () => { cancelled = true; };
  }, [courses]);

  // Auto-play between tabs every 7s.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setTab((p) => (p === "notes" ? "codes" : "notes"));
    }, 7000);
    return () => window.clearInterval(id);
  }, []);

  const streak = useMemo(
    () => computeStreak(courses, filesByCourse),
    [courses, filesByCourse],
  );

  return (
    <aside
      className="flex w-full flex-col gap-6"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Carrossel: Notas / Códigos */}
      <section className="rounded-3xl border border-border/40 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <header className="mb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {tab === "notes" ? (
              <BookOpen className="h-4 w-4 text-foreground/70" />
            ) : (
              <Code2 className="h-4 w-4 text-foreground/70" />
            )}
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {tab === "notes" ? t("sidebar.recentNotes") : t("sidebar.recentCodes")}
            </h2>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setTab("notes")}
              aria-label={t("sidebar.tabNotes")}
              title={t("sidebar.tabNotes")}
              className={`inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground ${tab === "notes" ? "text-foreground" : ""}`}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setTab("codes")}
              aria-label={t("sidebar.tabCodes")}
              title={t("sidebar.tabCodes")}
              className={`inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground ${tab === "codes" ? "text-foreground" : ""}`}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
            <Link
              to="/notes"
              className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={t("sidebar.allNotes")}
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <div key={tab} className="animate-fade-in">
        {tab === "notes" ? (
          notes.length === 0 ? (
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
                    <Link to="/course/$courseId" params={{ courseId: n.courseId }} className="block group">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{n.courseName}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary">{n.title}</h3>
                      {n.preview && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.preview}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          codes.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {t("sidebar.noCodes")}
            </p>
          ) : (
            <ul className="space-y-5">
              {codes.map((s) => {
                const cat = getCategory(s.category);
                const dot = cat ? cat.color.replace("text-", "bg-") : "bg-muted-foreground/40";
                return (
                  <li key={s.id}>
                    <Link to="/course/$courseId" params={{ courseId: s.courseId }} className="block group">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.courseName}</span>
                        <span className="rounded bg-secondary px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{languageLabel(s.language)}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary truncate">{s.title}</h3>
                      {s.preview && (
                        <p className="mt-0.5 line-clamp-1 font-mono text-[11px] leading-relaxed text-muted-foreground">{s.preview}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        )}
        </div>

        {(tab === "notes" ? notes.length : codes.length) > 0 && (
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
      <section
        className="relative overflow-hidden rounded-3xl border border-orange-200/60 bg-gradient-to-br from-orange-100/80 via-rose-100/70 to-amber-100/70 p-6 shadow-sm dark:border-orange-900/30 dark:from-orange-950/40 dark:via-rose-950/30 dark:to-amber-950/20"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-rose-500 shadow-sm dark:bg-rose-950/50 dark:text-rose-300">
            <Flame className="h-5 w-5 fill-current" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-rose-950 dark:text-rose-50">
              {t("sidebar.streakTitle", { n: streak })}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-rose-950/70 dark:text-rose-100/60">
              {t("sidebar.streakSubtitle")}
            </p>
          </div>
        </div>
      </section>
    </aside>
  );
}
