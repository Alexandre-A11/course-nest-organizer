import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { AppHeader } from "@/components/AppHeader";
import { FileTree } from "@/components/FileTree";
import { FileViewer } from "@/components/FileViewer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getCourse, listFiles, upsertFiles, touchCourseLastFile, bulkSetWatched,
  saveCourseCustomOrder, type Course, type CourseFileMeta, type FileKind,
} from "@/lib/db";
import { ensurePermission, scanDirectory, scanFileList, mergeScanWithMeta, getKind } from "@/lib/fs";
import { setCourseFiles, hasCourseFiles } from "@/lib/sessionFiles";
import { ArrowLeft, Search, RefreshCw, Loader2, AlertTriangle, FolderOpen, FolderTree, ListTree, X, Pencil, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import { usePref } from "@/lib/prefs";
import { EditCourseDialog } from "@/components/EditCourseDialog";
import { getCategory } from "@/lib/categories";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/course/$courseId")({
  component: CoursePage,
  head: () => ({
    meta: [
      { title: "Curso — Course Vault" },
      { name: "description", content: "Reproduza vídeos, leia PDFs e marque seu progresso." },
    ],
  }),
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [files, setFiles] = useState<CourseFileMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAccess, setNeedsAccess] = useState<null | "permission" | "memory">(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unwatched" | FileKind>("all");
  const [rescanning, setRescanning] = useState(false);
  const [flatView, setFlatView] = usePref<"on" | "off">("course.flatView", "off");
  const [focusFolder, setFocusFolder] = useState<string | null>(null);
  const [highlightFolder, setHighlightFolder] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const c = await getCourse(courseId);
      if (!c) {
        navigate({ to: "/" });
        return;
      }
      setCourse(c);
      if (c.source === "remote") {
        // Remote courses stream over HTTP — no local permission needed.
      } else if (c.source === "cached") {
        // Files live in IndexedDB — nothing to re-pick.
      } else if (c.source === "memory") {
        // Memory courses require re-picking the folder each session
        if (!hasCourseFiles(courseId)) {
          setNeedsAccess("memory");
          setLoading(false);
          return;
        }
      } else if (c.handle) {
        const granted = await ensurePermission(c.handle);
        if (!granted) {
          setNeedsAccess("permission");
          setLoading(false);
          return;
        }
      } else {
        // Handle source but no handle stored (e.g. corrupted) — show error
        setNeedsAccess("permission");
        setLoading(false);
        return;
      }
      const fs = await listFiles(courseId);
      setFiles(fs);
      // Auto-select last opened file if it still exists.
      if (c.lastFileId && fs.some((f) => f.id === c.lastFileId)) {
        setSelectedId(c.lastFileId);
      }
      setLoading(false);
    })();
  }, [courseId, navigate]);

  const requestPermission = async () => {
    if (!course || !course.handle) return;
    const granted = await ensurePermission(course.handle);
    if (granted) {
      setNeedsAccess(null);
      setLoading(true);
      const fs = await listFiles(courseId);
      setFiles(fs);
      setLoading(false);
    } else {
      toast.error(t("course.permDenied"));
    }
  };

  const handleReattachFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0 || !course) return;
    const { fileMap, rootName } = scanFileList(list);
    if (course.rootName && rootName !== course.rootName) {
      toast.warning(t("course.expectedFolder", { expected: course.rootName, got: rootName }));
    }
    setCourseFiles(courseId, fileMap);
    setNeedsAccess(null);
    (async () => {
      setLoading(true);
      const fs = await listFiles(courseId);
      setFiles(fs);
      setLoading(false);
    })();
  };

  const rescan = async () => {
    if (!course) return;
    setRescanning(true);
    try {
      if (course.source === "remote") {
        // Remote courses are kept in sync by the server/sync layer; just refresh the file list.
        const fs = await listFiles(courseId);
        setFiles(fs);
        toast.success(t("toast.synced", { n: fs.length }));
      } else if (course.source === "handle" && course.handle) {
        const granted = await ensurePermission(course.handle);
        if (!granted) { setNeedsAccess("permission"); return; }
        const scanned = await scanDirectory(course.handle);
        const existing = await listFiles(courseId);
        const merged = mergeScanWithMeta(courseId, scanned, existing);
        await upsertFiles(merged);
        setFiles(merged);
        toast.success(t("toast.synced", { n: merged.length }));
      } else {
        // Memory mode: rebuild from session cache
        const memFiles = (await import("@/lib/sessionFiles")).getCourseFiles(courseId);
        if (!memFiles) { setNeedsAccess("memory"); return; }
        const scanned = Array.from(memFiles.entries()).map(([path, f]) => ({
          path, name: f.name, size: f.size, kind: getKind(f.name),
        }));
        const existing = await listFiles(courseId);
        const merged = mergeScanWithMeta(courseId, scanned, existing);
        await upsertFiles(merged);
        setFiles(merged);
        toast.success(t("toast.synced", { n: merged.length }));
      }
    } finally {
      setRescanning(false);
    }
  };

  const filtered = useMemo(() => {
    return files.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.path.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "all") return true;
      if (filter === "unwatched") return !f.watched;
      return f.kind === filter;
    });
  }, [files, search, filter]);

  const selected = files.find((f) => f.id === selectedId) ?? null;

  // Clear stale multi-selection ids when the visible file list changes.
  useEffect(() => {
    if (multiSelected.size === 0) return;
    const visible = new Set(filtered.map((f) => f.id));
    let dirty = false;
    const next = new Set<string>();
    multiSelected.forEach((id) => { if (visible.has(id)) next.add(id); else dirty = true; });
    if (dirty) setMultiSelected(next);
  }, [filtered, multiSelected]);

  const handleMultiSelect = (file: CourseFileMeta, mods: { ctrl: boolean; shift: boolean }) => {
    setMultiSelected((prev) => {
      const next = new Set(prev);
      if (mods.shift && lastClickedId) {
        // Range select against the currently filtered list.
        const ids = filtered.map((f) => f.id);
        const a = ids.indexOf(lastClickedId);
        const b = ids.indexOf(file.id);
        if (a >= 0 && b >= 0) {
          const [start, end] = a < b ? [a, b] : [b, a];
          for (let i = start; i <= end; i++) next.add(ids[i]);
        } else {
          next.add(file.id);
        }
      } else {
        // Ctrl / Cmd toggle.
        if (next.has(file.id)) next.delete(file.id);
        else next.add(file.id);
      }
      return next;
    });
    setLastClickedId(file.id);
  };

  const doBulkSetWatched = async (watched: boolean) => {
    const ids = [...multiSelected];
    if (ids.length === 0) return;
    const updated = await bulkSetWatched(ids, watched);
    const map = new Map(updated.map((f) => [f.id, f]));
    setFiles((prev) => prev.map((f) => map.get(f.id) ?? f));
    toast.success(t("toast.bulkUpdated", { n: updated.length, plural: updated.length === 1 ? "" : "s" }));
    setMultiSelected(new Set());
  };

  const handleReorder = async (order: Record<string, number>) => {
    if (!course) return;
    setCourse({ ...course, customOrder: order });
    await saveCourseCustomOrder(course.id, order);
  };

  // Persist last-opened file whenever the user picks one.
  useEffect(() => {
    if (selectedId) {
      void touchCourseLastFile(courseId, selectedId);
    }
  }, [selectedId, courseId]);

  const stats = useMemo(() => {
    const videos = files.filter((f) => f.kind === "video");
    const watched = videos.filter((v) => v.watched).length;
    return {
      total: files.length,
      videos: videos.length,
      watched,
      progress: videos.length ? Math.round((watched / videos.length) * 100) : 0,
    };
  }, [files]);

  const handleUpdated = (f: CourseFileMeta) => {
    setFiles((prev) => prev.map((x) => (x.id === f.id ? f : x)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (needsAccess && course) {
    const isMemory = needsAccess === "memory";
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              {isMemory ? <FolderOpen className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground">
              {isMemory ? t("course.reopenTitle") : t("course.permissionTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isMemory
                ? t("course.reopenBody", { name: course.rootName ?? course.name })
                : t("course.permissionBody", { name: course.name })}
            </p>
            <input
              ref={fallbackInputRef}
              type="file"
              // @ts-expect-error webkitdirectory non-standard
              webkitdirectory=""
              directory=""
              multiple
              hidden
              onChange={handleReattachFolder}
            />
            <div className="mt-5 flex justify-center gap-2">
              <Link to="/"><Button variant="outline" className="rounded-xl">{t("btn.back")}</Button></Link>
              <Button
                onClick={() => isMemory ? fallbackInputRef.current?.click() : requestPermission()}
                className="rounded-xl"
              >
                {isMemory ? t("course.selectFolder") : t("course.authorize")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />

      {/* Course bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/" className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {course?.banner && (
              <img src={course.banner} alt="" className="hidden h-10 w-10 shrink-0 rounded-lg object-cover sm:block" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {course && getCategory(course.category) && (() => {
                  const cat = getCategory(course.category)!;
                  const Icon = cat.icon;
                  return <Icon className={`h-4 w-4 shrink-0 ${cat.color}`} aria-label={cat.name} />;
                })()}
                <h1 className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-xl">{course?.name}</h1>
                <button
                  onClick={() => setEditing(true)}
                  title={t("course.editTitle")}
                  className="rounded p-1 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              {course?.description && <p className="truncate text-xs text-muted-foreground">{course.description}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-1.5">
              <div className="text-xs">
                <span className="font-display text-base font-bold text-foreground">{stats.progress}%</span>
                <span className="ml-1 text-muted-foreground">({stats.watched}/{stats.videos})</span>
              </div>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary sm:w-24">
                <div className="h-full rounded-full bg-gradient-hero transition-all" style={{ width: `${stats.progress}%` }} />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={rescan} disabled={rescanning} className="h-8 rounded-xl gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${rescanning ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t("course.sync")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr]">
        {/* Sidebar */}
        <aside className="flex flex-col overflow-hidden border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("course.search")}
                className="rounded-xl pl-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                value={filter}
                onValueChange={(v) => v && setFilter(v as typeof filter)}
                className="justify-start gap-1"
              >
                <ToggleGroupItem value="all" size="sm" className="h-7 rounded-lg px-2.5 text-xs">{t("course.filterAll")}</ToggleGroupItem>
                <ToggleGroupItem value="video" size="sm" className="h-7 rounded-lg px-2.5 text-xs">{t("course.filterVideos")}</ToggleGroupItem>
                <ToggleGroupItem value="pdf" size="sm" className="h-7 rounded-lg px-2.5 text-xs">{t("course.filterPdfs")}</ToggleGroupItem>
                <ToggleGroupItem value="unwatched" size="sm" className="h-7 rounded-lg px-2.5 text-xs">{t("course.filterPending")}</ToggleGroupItem>
              </ToggleGroup>
              <div className="flex items-center gap-1">
                <Toggle
                  size="sm"
                  pressed={flatView === "on"}
                  onPressedChange={(p) => setFlatView(p ? "on" : "off")}
                  className="h-7 rounded-lg px-2"
                  title={flatView === "on" ? t("course.foldersFlat") : t("course.foldersTree")}
                  aria-label={t("course.toggleFolders")}
                >
                  {flatView === "on" ? <ListTree className="h-3.5 w-3.5" /> : <FolderTree className="h-3.5 w-3.5" />}
                </Toggle>
                {focusFolder && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFocusFolder(null)}
                    className="h-7 gap-1 rounded-lg px-2 text-xs"
                    title={t("course.clearFocus")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {multiSelected.size > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft px-2 py-1.5">
                <span className="text-xs font-medium text-primary">
                  {t("course.bulkSelected", { n: multiSelected.size, plural: multiSelected.size === 1 ? "" : "s" })}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void doBulkSetWatched(true)}
                    className="h-7 gap-1 rounded-lg px-2 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("course.bulkMarkWatched")}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void doBulkSetWatched(false)}
                    className="h-7 gap-1 rounded-lg px-2 text-xs"
                  >
                    <Circle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("course.bulkMarkUnwatched")}</span>
                  </Button>
                  <button
                    onClick={() => setMultiSelected(new Set())}
                    title={t("course.bulkClear")}
                    className="rounded p-1 text-primary/70 hover:bg-primary/10 hover:text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("course.noFiles")}</p>
            ) : (
              <FileTree
                files={filtered}
                selectedId={selectedId}
                onSelect={(f) => setSelectedId(f.id)}
                flat={flatView === "on"}
                focusFolder={focusFolder}
                onSetFocusFolder={setFocusFolder}
                highlightFolder={highlightFolder}
                customOrder={course?.customOrder}
                onReorder={handleReorder}
                selectedIds={multiSelected}
                onMultiSelect={handleMultiSelect}
              />
            )}
          </div>
        </aside>

        {/* Viewer */}
        <section className="overflow-hidden">
          {selected && course ? (
            <FileViewer
              course={course}
              file={selected}
              onUpdated={handleUpdated}
              onLocateFolder={(folder) => {
                setFlatView("off");
                setHighlightFolder(folder);
                // clear highlight after a moment so re-clicks re-trigger
                setTimeout(() => setHighlightFolder(null), 1800);
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-10 text-center">
              <div className="max-w-sm">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{t("course.selectFile")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("course.selectHint")}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <EditCourseDialog
        course={course}
        open={editing}
        onOpenChange={setEditing}
        onSaved={(c) => setCourse(c)}
      />
    </div>
  );
}