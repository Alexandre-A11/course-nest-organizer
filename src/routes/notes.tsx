import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup, ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  getDB, setFileComment, deleteSnapshot, restoreSnapshot,
  type Course, type CourseFileMeta, type CodeSnapshot,
} from "@/lib/db";
import { highlightCode, languageLabel, SUPPORTED_LANGUAGES } from "@/lib/highlight";
import { useI18n } from "@/lib/i18n";
import { getCategory } from "@/lib/categories";
import {
  Search, NotebookPen, Code2, FileText, PlayCircle, FileAudio, FileImage, File as FileIcon,
  ExternalLink, Copy, X, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({
  component: NotesPage,
  head: () => ({
    meta: [
      { title: "Notas — Course Vault" },
      { name: "description", content: "Pesquise todas as suas anotações e snapshots de código." },
    ],
  }),
});

type Tab = "all" | "notes" | "snapshots";

interface NoteRow {
  fileId: string;
  courseId: string;
  fileName: string;
  filePath: string;
  fileKind: CourseFileMeta["kind"];
  courseName: string;
  courseCategory?: string;
  html: string;
  text: string;       // plain-text projection used for searching
  updatedAt: number;
}

interface SnapRow extends CodeSnapshot {
  fileName: string;
  filePath: string;
  fileKind: CourseFileMeta["kind"];
  courseName: string;
  courseCategory?: string;
}

function htmlToPlain(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || "").replace(/\s+/g, " ").trim();
}

const KIND_ICON = {
  video: PlayCircle,
  pdf: FileText,
  audio: FileAudio,
  image: FileImage,
  doc: FileText,
  other: FileIcon,
} as const;

function NotesPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Map<string, Course>>(new Map());
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [snaps, setSnaps] = useState<SnapRow[]>([]);

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [courseId, setCourseId] = useState<string>("__all");
  const [language, setLanguage] = useState<string>("__all");

  // ---------- Delete handlers (with Undo toasts) ----------

  const handleDeleteNote = async (row: NoteRow) => {
    const previous = row.html;
    // Optimistic remove from the list.
    setNotes((prev) => prev.filter((n) => n.fileId !== row.fileId));
    await setFileComment(row.fileId, undefined);
    toast.success(t("note.deleted"), {
      action: {
        label: t("snap.undo"),
        onClick: async () => {
          const restored = await setFileComment(row.fileId, previous);
          if (restored) {
            setNotes((prev) => {
              if (prev.some((n) => n.fileId === row.fileId)) return prev;
              return [{ ...row, html: previous, updatedAt: restored.updatedAt ?? Date.now() }, ...prev]
                .sort((a, b) => b.updatedAt - a.updatedAt);
            });
            toast.success(t("note.restored"));
          }
        },
      },
    });
  };

  const handleDeleteSnap = async (row: SnapRow) => {
    setSnaps((prev) => prev.filter((s) => s.id !== row.id));
    await deleteSnapshot(row.id);
    toast.success(t("snap.deleted"), {
      action: {
        label: t("snap.undo"),
        onClick: async () => {
          const restored = await restoreSnapshot(row.id);
          if (restored) {
            setSnaps((prev) => {
              if (prev.some((s) => s.id === row.id)) return prev;
              return [{ ...row, ...restored }, ...prev]
                .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
            });
            toast.success(t("snap.restored"));
          }
        },
      },
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDB();
      const allCourses = await db.getAll("courses");
      const allFiles = await db.getAll("files");
      const allSnaps = (await db.getAll("snapshots")).filter((s) => !s.deleted);
      if (cancelled) return;
      const cmap = new Map(allCourses.map((c) => [c.id, c]));
      const fmap = new Map(allFiles.map((f) => [f.id, f]));
      const noteRows: NoteRow[] = allFiles
        .filter((f) => typeof f.comment === "string" && f.comment.trim().length > 0)
        .map((f) => {
          const c = cmap.get(f.courseId);
          return {
            fileId: f.id,
            courseId: f.courseId,
            fileName: f.name,
            filePath: f.path,
            fileKind: f.kind,
            courseName: c?.name ?? "—",
            courseCategory: c?.category,
            html: f.comment as string,
            text: htmlToPlain(f.comment as string),
            updatedAt: f.updatedAt ?? 0,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const snapRows: SnapRow[] = allSnaps
        .map((s) => {
          const f = fmap.get(s.fileId);
          const c = cmap.get(s.courseId);
          return {
            ...s,
            fileName: f?.name ?? "—",
            filePath: f?.path ?? "",
            fileKind: f?.kind ?? "other",
            courseName: c?.name ?? "—",
            courseCategory: c?.category,
          };
        })
        .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
      setCourses(cmap);
      setNotes(noteRows);
      setSnaps(snapRows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (courseId !== "__all" && n.courseId !== courseId) return false;
      if (!q) return true;
      return (
        n.text.toLowerCase().includes(q) ||
        n.fileName.toLowerCase().includes(q) ||
        n.courseName.toLowerCase().includes(q)
      );
    });
  }, [notes, query, courseId]);

  const filteredSnaps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snaps.filter((s) => {
      if (courseId !== "__all" && s.courseId !== courseId) return false;
      if (language !== "__all" && s.language !== language) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        (s.title?.toLowerCase().includes(q) ?? false) ||
        s.fileName.toLowerCase().includes(q) ||
        s.courseName.toLowerCase().includes(q)
      );
    });
  }, [snaps, query, courseId, language]);

  const showNotes = tab === "all" || tab === "notes";
  const showSnaps = tab === "all" || tab === "snapshots";

  const courseOptions = useMemo(
    () => Array.from(courses.values()).sort((a, b) => a.name.localeCompare(b.name)),
    [courses],
  );

  const totals = useMemo(() => ({
    notes: filteredNotes.length,
    snaps: filteredSnaps.length,
  }), [filteredNotes.length, filteredSnaps.length]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("notesPage.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("notesPage.subtitle")}
            </p>
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t("btn.back")}
          </Link>
        </header>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-soft">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("notesPage.searchPh")}
              className="rounded-xl pl-9 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Clear"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="h-9 w-[200px] rounded-xl text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("notesPage.allCourses")}</SelectItem>
              {courseOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(tab === "all" || tab === "snapshots") && (
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="h-9 w-[160px] rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                <SelectItem value="__all">{t("notesPage.allLangs")}</SelectItem>
                {SUPPORTED_LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <ToggleGroup
            type="single"
            value={tab}
            onValueChange={(v) => v && setTab(v as Tab)}
            className="gap-1"
          >
            <ToggleGroupItem value="all" size="sm" className="h-8 rounded-lg px-3 text-xs">
              {t("notesPage.tabAll")}
            </ToggleGroupItem>
            <ToggleGroupItem value="notes" size="sm" className="h-8 gap-1 rounded-lg px-3 text-xs">
              <NotebookPen className="h-3.5 w-3.5" />
              {t("notesPage.tabNotes")} ({notes.length})
            </ToggleGroupItem>
            <ToggleGroupItem value="snapshots" size="sm" className="h-8 gap-1 rounded-lg px-3 text-xs">
              <Code2 className="h-3.5 w-3.5" />
              {t("notesPage.tabSnaps")} ({snaps.length})
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">…</p>
        ) : (
          <>
            {showNotes && (
              <Section
                title={t("notesPage.notesSection")}
                icon={<NotebookPen className="h-4 w-4" />}
                count={totals.notes}
              >
                {filteredNotes.length === 0 ? (
                  <Empty label={t("notesPage.emptyNotes")} />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {filteredNotes.map((n) => (
                      <NoteCard key={n.fileId} row={n} query={query} onDelete={() => handleDeleteNote(n)} />
                    ))}
                  </ul>
                )}
              </Section>
            )}
            {showSnaps && (
              <Section
                title={t("notesPage.snapsSection")}
                icon={<Code2 className="h-4 w-4" />}
                count={totals.snaps}
              >
                {filteredSnaps.length === 0 ? (
                  <Empty label={t("notesPage.emptySnaps")} />
                ) : (
                  <ul className="space-y-3">
                    {filteredSnaps.map((s) => (
                      <SnapCard key={s.id} row={s} onDelete={() => handleDeleteSnap(s)} />
                    ))}
                  </ul>
                )}
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Section({
  title, icon, count, children,
}: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function CourseTag({ name, category }: { name: string; category?: string }) {
  const cat = category ? getCategory(category) : null;
  const Icon = cat?.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
      {Icon && <Icon className={cn("h-3 w-3", cat?.color)} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

function NoteCard({ row, query, onDelete }: { row: NoteRow; query: string; onDelete: () => void }) {
  const { t } = useI18n();
  const Icon = KIND_ICON[row.fileKind] ?? FileIcon;
  const snippet = useMemo(() => {
    const text = row.text;
    const q = query.trim().toLowerCase();
    if (!q) return text.slice(0, 220);
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return text.slice(0, 220);
    const start = Math.max(0, i - 60);
    return (start > 0 ? "…" : "") + text.slice(start, start + 220);
  }, [row.text, query]);
  return (
    <li className="group flex max-h-96 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-elevated">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">{row.fileName}</span>
        <button
          onClick={onDelete}
          title={t("snap.delete")}
          className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="overflow-y-auto text-sm text-muted-foreground">{snippet}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <CourseTag name={row.courseName} category={row.courseCategory} />
        <Link
          to="/course/$courseId"
          params={{ courseId: row.courseId }}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {t("notesPage.openCourse")}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}

function SnapCard({ row, onDelete }: { row: SnapRow; onDelete: () => void }) {
  const { t } = useI18n();
  const Icon = KIND_ICON[row.fileKind] ?? FileIcon;
  const html = useMemo(() => highlightCode(row.code, row.language), [row.code, row.language]);
  const when = useMemo(() => new Date(row.createdAt).toLocaleString(), [row.createdAt]);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(row.code);
      toast.success(t("snap.copied"));
    } catch { toast.error(t("toast.copyErr")); }
  };
  return (
    <li className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="flex items-start justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {languageLabel(row.language)}
            </span>
            {row.title && (
              <span className="truncate text-sm font-medium text-foreground">{row.title}</span>
            )}
            <CourseTag name={row.courseName} category={row.courseCategory} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Icon className="h-3 w-3" />
            <span className="truncate">{row.fileName}</span>
            <span>·</span>
            <span>{when}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm" variant="ghost" onClick={handleCopy}
            className="h-7 gap-1 rounded-lg px-2 text-xs"
            title={t("snap.copy")}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Link
            to="/course/$courseId"
            params={{ courseId: row.courseId }}
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-primary hover:bg-primary/10"
            title={t("notesPage.openCourse")}
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Button
            size="sm" variant="ghost" onClick={onDelete}
            className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title={t("snap.delete")}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <pre className="cv-code max-h-96 overflow-auto rounded-none border-0">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </li>
  );
}