import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Course, CourseFileMeta } from "@/lib/db";
import { upsertFile, saveFileProgress } from "@/lib/db";
import { formatBytes } from "@/lib/fs";
import { streamUrlFor } from "@/lib/syncClient";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle2, Circle, Download, FileText, FileAudio, File as FileIcon,
  FolderTree, Gauge, Copy, Check, FileDown, EyeOff, Eye, Pause, Play,
  Maximize2, Minimize2, Tv, Monitor, Code2, NotebookText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichNoteEditor } from "@/components/notes/RichNoteEditor";
import { SnapshotsPanel } from "@/components/notes/SnapshotsPanel";
import { TagEditor } from "@/components/notes/TagEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import { exportNotes, type ExportFormat } from "@/lib/exportNotes";
import { usePref } from "@/lib/prefs";
import { useI18n } from "@/lib/i18n";

interface Props {
  course: Course;
  file: CourseFileMeta;
  onUpdated: (f: CourseFileMeta) => void;
  onLocateFolder?: (folderPath: string) => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SPEED_KEY = "course-vault.playbackRate";
const NOTES_WIDTH_KEY = "course-vault.notesWidth";
const PAUSE_ON_TYPE_KEY = "course-vault.pauseOnType";
const VIEW_MODE_KEY = "course-vault.viewMode";

/** "normal" = layout padrão, "theater" = vídeo ocupa toda a área (fundo preto, sem notas), "fullscreen" = navegador em fullscreen */
type ViewMode = "normal" | "theater";

const DEFAULT_NOTES_WIDTH = 420;
const MIN_NOTES_WIDTH = 280;
const MAX_NOTES_WIDTH = 720;

export function FileViewer({ course, file, onUpdated, onLocateFolder }: Props) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState(file.comment ?? "");
  const [savingComment, setSavingComment] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [tags, setTags] = useState<string[]>(file.tags ?? []);
  const [pathCopied, setPathCopied] = useState(false);
  const [notesVisible, setNotesVisible] = usePref<"on" | "off">("notes.visible", "on");
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "normal";
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    return v === "theater" ? "theater" : "normal";
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pauseOnType, setPauseOnType] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PAUSE_ON_TYPE_KEY) === "1";
  });
  const [notesWidth, setNotesWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_NOTES_WIDTH;
    const v = parseInt(window.localStorage.getItem(NOTES_WIDTH_KEY) ?? "", 10);
    if (Number.isFinite(v) && v >= MIN_NOTES_WIDTH && v <= MAX_NOTES_WIDTH) return v;
    return DEFAULT_NOTES_WIDTH;
  });
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = parseFloat(window.localStorage.getItem(SPEED_KEY) ?? "1");
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const blobRef = useRef<File | null>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingRef = useRef(false);
  /** Last persisted playback position (sec) — throttle disk writes. */
  const lastSavedTimeRef = useRef<number>(-Infinity);
  /** Resume target captured from file.progress when the file changes. */
  const resumeAtRef = useRef<number | null>(null);

  const folderPath = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "";

  // Load file blob -> objectURL. CRITICAL: do NOT depend on file.comment, otherwise
  // the video reloads (and resets to t=0) on every keystroke in the notes.
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    // Capture resume target for this file BEFORE we start loading.
    resumeAtRef.current = (file.kind === "video" || file.kind === "audio") && file.progress && file.progress > 1
      ? file.progress
      : null;
    lastSavedTimeRef.current = -Infinity;

    (async () => {
      try {
        // Remote courses are streamed via HTTP — no Blob, no objectURL.
        if (!course.remoteFolder) throw new Error(t("viewer.openErr"));
        const stream = streamUrlFor(course.remoteFolder, file.path);
        if (!stream) throw new Error(t("viewer.openErr"));
        if (!active) return;
        blobRef.current = null;
        setUrl(stream);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        const msg = (e as Error).message ?? t("viewer.openErr");
        setError(msg.includes("permission") ? t("viewer.permExpired") : msg);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [course, file.id, file.path, file.kind, file.progress, t]);

  // Sync local comment state when file changes (separate from blob effect).
  useEffect(() => {
    setComment(file.comment ?? "");
    setTags(file.tags ?? []);
  }, [file.id, file.comment, file.tags]);

  // Apply persisted speed when media element mounts / file changes
  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  }, [speed, url]);

  // Notes width drag
  const dragStartRef = useRef<{ x: number; w: number } | null>(null);
  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, w: notesWidth };
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = dragStartRef.current.x - e.clientX;
    const next = Math.min(MAX_NOTES_WIDTH, Math.max(MIN_NOTES_WIDTH, dragStartRef.current.w + dx));
    setNotesWidth(next);
  };
  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    try { window.localStorage.setItem(NOTES_WIDTH_KEY, String(notesWidth)); } catch { /* ignore */ }
  };

  const setSpeedAndPersist = (s: number) => {
    setSpeed(s);
    if (mediaRef.current) mediaRef.current.playbackRate = s;
    try { window.localStorage.setItem(SPEED_KEY, String(s)); } catch { /* ignore */ }
  };

  const togglePauseOnType = () => {
    setPauseOnType((v) => {
      const next = !v;
      try { window.localStorage.setItem(PAUSE_ON_TYPE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleTheater = () => {
    setViewMode((m) => {
      const next: ViewMode = m === "theater" ? "normal" : "theater";
      try { window.localStorage.setItem(VIEW_MODE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch { /* ignore */ }
  };

  // Mirror native fullscreen state.
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Keyboard shortcuts: F = fullscreen, T = theater (only for media files).
  useEffect(() => {
    if (file.kind !== "video" && file.kind !== "audio") return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Ignore when typing in inputs / contentEditable (notes).
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void toggleFullscreen();
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        toggleTheater();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.kind]);

  const toggleWatched = async () => {
    const updated = { ...file, watched: !file.watched, watchedAt: !file.watched ? Date.now() : undefined };
    await upsertFile(updated);
    onUpdated(updated);
    if (updated.watched) {
      const msg =
        file.kind === "video" ? t("toast.markedWatched")
        : file.kind === "audio" ? t("toast.markedListened")
        : (file.kind === "pdf" || file.kind === "doc") ? t("toast.markedRead")
        : t("toast.markedDone");
      toast.success(msg);
    } else {
      toast.success(t("toast.unmarked"));
    }
  };

  const handleCommentChange = (val: string) => {
    setComment(val);
    if (commentTimer.current) clearTimeout(commentTimer.current);
    setSavingComment(true);
    commentTimer.current = setTimeout(async () => {
      const updated = { ...file, comment: stripIfEmpty(val) };
      await upsertFile(updated);
      onUpdated(updated);
      setSavingComment(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }, 500);
  };

  const handleTagsChange = async (next: string[]) => {
    setTags(next);
    const updated = { ...file, tags: next.length ? next : undefined };
    await upsertFile(updated);
    onUpdated(updated);
  };

  // Pause-on-type lifecycle: when the user focuses the editor, pause; when they
  // blur (or toggle off), resume if it was playing.
  const handleEditorFocus = useCallback(() => {
    if (!pauseOnType) return;
    const m = mediaRef.current;
    if (!m) return;
    if (!m.paused) {
      wasPlayingRef.current = true;
      m.pause();
    }
  }, [pauseOnType]);

  const handleEditorBlur = useCallback(() => {
    if (!pauseOnType) return;
    const m = mediaRef.current;
    if (!m) return;
    if (wasPlayingRef.current) {
      wasPlayingRef.current = false;
      m.play().catch(() => { /* ignore */ });
    }
  }, [pauseOnType]);

  const buildTimestampSnippet = (): string | null => {
    const t = mediaRef.current?.currentTime;
    if (t == null) return null;
    const stamp = formatTime(t);
    return `[${stamp}] `;
  };

  const downloadFile = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  };

  const copyPath = async () => {
    const full = folderPath || course.rootName || course.name;
    try {
      await navigator.clipboard.writeText(full);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 1400);
      toast.success(t("toast.copied"));
    } catch {
      toast.error(t("toast.copyErr"));
    }
  };

  const handleVideoEnded = async () => {
    // Reset progress so "continue" doesn't keep landing at the end.
    void saveFileProgress(file.id, 0);
    if (file.watched) return;
    const updated = { ...file, watched: true, watchedAt: Date.now() };
    await upsertFile(updated);
    onUpdated(updated);
    toast.success(t("toast.lessonDone"));
  };

  const seekTo = (sec: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = sec;
      mediaRef.current.play().catch(() => { /* ignore */ });
    }
  };

  const tokens = useMemo(() => parseTimestamps(stripHtml(comment)), [comment]);
  const isMedia = file.kind === "video" || file.kind === "audio";
  const showNotes = notesVisible === "on";

  // Label for the "watched" toggle depends on the file kind.
  const watchedLabels = (() => {
    if (file.kind === "video") return { done: t("card.watchedVideo"), todo: t("card.markVideo") };
    if (file.kind === "audio") return { done: t("card.watchedAudio"), todo: t("card.markAudio") };
    if (file.kind === "pdf" || file.kind === "doc") {
      return { done: t("card.watchedDoc"), todo: t("card.markDoc") };
    }
    return { done: t("card.watchedOther"), todo: t("card.markOther") };
  })();

  const handleExport = (format: ExportFormat) => {
    exportNotes(format, {
      filename: `${course.name} - ${file.name.replace(/\.[^.]+$/, "")}`,
      title: file.name,
      html: comment,
    });
    toast.success(t("toast.notesExported", { format: format.toUpperCase() }));
  };

  // Force-hide notes when in theater mode so the video can take the full area.
  const showNotesEffective = showNotes && viewMode === "normal";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full flex-col md:flex-row",
        viewMode === "theater" && "bg-black",
        isFullscreen && "bg-black",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4",
            // Slimmer chrome in theater mode
            viewMode === "theater" && "border-transparent bg-black/80 py-2 sm:py-2",
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground line-clamp-1">
                {folderPath || course.name}
              </p>
              {folderPath && onLocateFolder && (
                <button
                  onClick={() => onLocateFolder(folderPath)}
                  title={t("viewer.folderShow")}
                  className="rounded p-0.5 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
                >
                  <FolderTree className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={copyPath}
                title={t("viewer.copyPath")}
                className="rounded p-0.5 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
              >
                {pathCopied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <h2 className="mt-0.5 font-display text-base sm:text-lg font-semibold tracking-tight text-foreground line-clamp-1">
              {file.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {isMedia && (
              <>
                <Button
                  variant={pauseOnType ? "default" : "outline"}
                  size="sm"
                  onClick={togglePauseOnType}
                  className="h-8 rounded-xl gap-1.5 px-2.5"
                  title={pauseOnType ? t("viewer.pauseOn") : t("viewer.pauseOff")}
                >
                  {pauseOnType ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span className="hidden lg:inline">{pauseOnType ? t("viewer.pauseLabelOn") : t("viewer.pauseLabelOff")}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 rounded-xl gap-1.5 px-2.5">
                      <Gauge className="h-3.5 w-3.5" />
                      {speed}×
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    {SPEEDS.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setSpeedAndPersist(s)}
                        className={cn("justify-between", s === speed && "font-semibold text-primary")}
                      >
                        {s}×
                        {s === speed && <Check className="h-3.5 w-3.5" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {file.kind === "video" && (
                  <>
                    <Button
                      variant={viewMode === "theater" ? "default" : "outline"}
                      size="sm"
                      onClick={toggleTheater}
                      className="h-8 rounded-xl gap-1.5 px-2.5"
                      title={viewMode === "theater" ? t("viewer.theaterOff") : t("viewer.theaterOn")}
                    >
                      {viewMode === "theater" ? <Monitor className="h-3.5 w-3.5" /> : <Tv className="h-3.5 w-3.5" />}
                      <span className="hidden lg:inline">{t("viewer.theaterLabel")}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleFullscreen()}
                      className="h-8 rounded-xl gap-1.5 px-2.5"
                      title={isFullscreen ? t("viewer.fullscreenExit") : t("viewer.fullscreenEnter")}
                    >
                      {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      <span className="hidden lg:inline">{t("viewer.fullscreenLabel")}</span>
                    </Button>
                  </>
                )}
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotesVisible(showNotes ? "off" : "on")}
              className="h-8 rounded-xl gap-1.5 px-2.5"
              title={showNotes ? t("viewer.notesHide") : t("viewer.notesShow")}
            >
              {showNotes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{showNotes ? t("viewer.notesLabelHide") : t("viewer.notesLabelShow")}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadFile} disabled={!url} className="h-8 rounded-xl gap-1.5 px-2.5">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("viewer.download")}</span>
            </Button>
            <Button
              variant={file.watched ? "default" : "outline"}
              size="sm"
              onClick={toggleWatched}
              className={cn("h-8 rounded-xl gap-1.5 px-2.5", file.watched && "bg-success hover:bg-success/90 text-success-foreground")}
            >
              {file.watched ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{file.watched ? watchedLabels.done : watchedLabels.todo}</span>
            </Button>
          </div>
        </div>

        {/* Viewer */}
        <div
          className={cn(
            "flex-1 overflow-auto",
            viewMode === "theater" || isFullscreen ? "bg-black" : "bg-muted/30",
          )}
        >
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
                {error}
              </div>
            </div>
          ) : (
            <ViewerContent
              file={file}
              url={url!}
              onVideoEnded={handleVideoEnded}
              mediaRef={mediaRef}
              initialSpeed={speed}
              fillStage={viewMode === "theater" || isFullscreen}
            resumeAt={resumeAtRef.current}
            onTimeUpdate={(sec) => {
              if (file.kind !== "video" && file.kind !== "audio") return;
              // Persist at most every 5s.
              if (Math.abs(sec - lastSavedTimeRef.current) >= 5) {
                lastSavedTimeRef.current = sec;
                void saveFileProgress(file.id, sec);
              }
            }}
            onPause={(sec) => {
              if (file.kind !== "video" && file.kind !== "audio") return;
              lastSavedTimeRef.current = sec;
              void saveFileProgress(file.id, sec);
            }}
            />
          )}
        </div>
      </div>

      {/* Notes sidebar (vertical only). On mobile (<md) it stacks below. */}
      {showNotesEffective && (
        <>
          {/* Drag handle (visible on md+) */}
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className="hidden md:flex w-1.5 cursor-col-resize select-none items-center justify-center bg-border/40 transition-colors hover:bg-primary/40"
            title={t("viewer.dragResize")}
          >
            <div className="h-8 w-0.5 rounded-full bg-muted-foreground/40" />
          </div>
          <aside
            className="flex flex-col bg-card md:shrink-0 border-t md:border-t-0 border-border w-full md:border-l"
            style={typeof window !== "undefined" && window.innerWidth >= 768 ? { width: notesWidth } : undefined}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("notes.title")}
                {savingComment ? (
                  <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-muted-foreground/70">{t("notes.saving")}</span>
                ) : savedFlash ? (
                  <span className="ml-1 flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal text-success">
                    <Check className="h-3 w-3" /> {t("notes.saved")}
                  </span>
                ) : null}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-xs">
                    <FileDown className="h-3.5 w-3.5" />
                    {t("notes.export")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => handleExport("pdf")}>PDF (.pdf)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("doc")}>Word (.doc)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("md")}>Markdown (.md)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("html")}>HTML (.html)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("txt")}>Texto (.txt)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Tabs defaultValue="notes" className="flex flex-1 flex-col overflow-hidden">
              <TabsList className="mx-3 mt-2 h-8 w-fit rounded-lg bg-muted/60 p-0.5">
                <TabsTrigger value="notes" className="h-7 gap-1.5 rounded-md px-2.5 text-xs">
                  <NotebookText className="h-3.5 w-3.5" />
                  {t("notes.title")}
                </TabsTrigger>
                <TabsTrigger value="code" className="h-7 gap-1.5 rounded-md px-2.5 text-xs">
                  <Code2 className="h-3.5 w-3.5" />
                  {t("snap.tabTitle")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="notes" className="m-0 flex-1 overflow-auto px-4 py-3 sm:px-6">
                <TagEditor value={tags} onChange={handleTagsChange} className="mb-3" />
                <RichNoteEditor
                  value={comment}
                  onChange={handleCommentChange}
                  onFocus={handleEditorFocus}
                  onBlur={handleEditorBlur}
                  placeholder={isMedia ? t("notes.placeholderMedia") : t("notes.placeholderOther")}
                  onInsertTimestamp={isMedia ? buildTimestampSnippet : undefined}
                />
                {isMedia && tokens.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tokens.map((tok, i) => (
                      <button
                        key={i}
                        onClick={() => seekTo(tok.seconds)}
                        className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                      >
                        ▶ {tok.label}
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="code" className="m-0 flex-1 overflow-hidden">
                <SnapshotsPanel fileId={file.id} courseId={file.courseId} />
              </TabsContent>
            </Tabs>
          </aside>
        </>
      )}
    </div>
  );
}

function ViewerContent({
  file, url, onVideoEnded, mediaRef, initialSpeed, resumeAt, onTimeUpdate, onPause, fillStage,
}: {
  file: CourseFileMeta;
  url: string;
  onVideoEnded: () => void;
  mediaRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  initialSpeed: number;
  resumeAt?: number | null;
  onTimeUpdate?: (sec: number) => void;
  onPause?: (sec: number) => void;
  /** When true, the video fills the available stage area edge-to-edge (theater/fullscreen). */
  fillStage?: boolean;
}) {
  const handleLoaded = (el: HTMLMediaElement | null) => {
    if (!el) return;
    el.playbackRate = initialSpeed;
    if (resumeAt && resumeAt > 1 && Number.isFinite(resumeAt)) {
      try { el.currentTime = resumeAt; } catch { /* ignore */ }
    }
  };
  const onTU = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    onTimeUpdate?.(e.currentTarget.currentTime);
  };
  const onP = (e: React.SyntheticEvent<HTMLMediaElement>) => {
    onPause?.(e.currentTarget.currentTime);
  };
  if (file.kind === "video") {
    return (
      <div className={cn(
        "flex h-full items-center justify-center bg-black",
        fillStage ? "p-0" : "p-0 sm:p-6",
      )}>
        <CustomVideoPlayer
          src={url}
          fileName={file.name}
          registerRef={(el) => { mediaRef.current = el; }}
          className={cn(
            "max-h-full max-w-full",
            fillStage ? "h-full w-full" : "rounded-lg shadow-elevated",
          )}
          onEnded={onVideoEnded}
          onLoadedMetadata={(e) => handleLoaded(e.currentTarget as HTMLVideoElement)}
          onTimeUpdate={onTU}
          onPause={onP}
        />
      </div>
    );
  }

  if (file.kind === "pdf") {
    return <iframe src={url} title={file.name} className="h-full w-full border-0" />;
  }

  if (file.kind === "audio") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
        <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-hero text-primary-foreground shadow-elevated">
          <FileAudio className="h-14 w-14" />
        </div>
        <audio
          ref={(el) => { mediaRef.current = el; }}
          src={url}
          controls
          className="w-full max-w-md"
          onEnded={onVideoEnded}
          onLoadedMetadata={(e) => handleLoaded(e.currentTarget)}
          onTimeUpdate={onTU}
          onPause={onP}
        />
      </div>
    );
  }

  if (file.kind === "image") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg shadow-soft" />
      </div>
    );
  }

  // Inline preview for text-like and HTML files
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const HTML_EXTS = ["html", "htm"];
  const TEXT_EXTS = ["txt", "md", "markdown", "json", "csv", "tsv", "log", "xml", "yml", "yaml", "rtf"];

  if (HTML_EXTS.includes(ext)) {
    return (
      <iframe
        src={url}
        title={file.name}
        sandbox="allow-same-origin"
        className="h-full w-full border-0 bg-white"
      />
    );
  }

  if (TEXT_EXTS.includes(ext)) {
    return <TextPreview url={url} name={file.name} />;
  }

  const Icon = file.kind === "doc" ? FileText : FileIcon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Icon className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} />
      <div>
        <PreviewUnavailable />
      </div>
    </div>
  );
}

function PreviewUnavailable() {
  // Hook usage isolated so the parent stays a non-component helper.
  const { t } = useI18n();
  return (
    <>
      <p className="font-display text-base font-semibold text-foreground">{t("viewer.previewUnavail")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("viewer.previewOfficeMsg")}</p>
    </>
  );
}

function TextPreview({ url, name }: { url: string; name: string }) {
  const { t } = useI18n();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErr(null);
    fetch(url)
      .then((r) => r.text())
      .then((t) => { if (active) { setContent(t); setLoading(false); } })
      .catch((e) => { if (active) { setErr((e as Error).message); setLoading(false); } });
    return () => { active = false; };
  }, [url]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (err) {
    return <div className="p-6 text-sm text-destructive">{err}</div>;
  }
  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-card p-4 sm:p-6 font-mono text-[13px] leading-relaxed text-foreground">
      {content || t("viewer.empty", { name })}
    </pre>
  );
}

// Helpers
function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? "";
}

function stripIfEmpty(html: string): string | undefined {
  const text = stripHtml(html).trim();
  if (!text) return undefined;
  return html;
}

function parseTimestamps(text: string): { label: string; seconds: number }[] {
  const re = /\[(\d{1,2}(?::\d{1,2}){1,2})\]/g;
  const out: { label: string; seconds: number }[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = m[1];
    if (seen.has(label)) continue;
    seen.add(label);
    const parts = label.split(":").map((p) => parseInt(p, 10));
    let secs = 0;
    if (parts.length === 2) secs = parts[0] * 60 + parts[1];
    else if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (Number.isFinite(secs)) out.push({ label, seconds: secs });
  }
  return out;
}
