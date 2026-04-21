import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, CourseFileMeta } from "@/lib/db";
import { upsertFile } from "@/lib/db";
import { getFileFromCourse, formatBytes } from "@/lib/fs";
import { getCourseFiles } from "@/lib/sessionFiles";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle2, Circle, Download, FileText, FileAudio, File as FileIcon,
  FolderTree, Gauge, Copy, Check, FileDown, PanelRightClose, PanelBottomClose,
  PanelRight, EyeOff, Eye, Columns2, Rows2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichNoteEditor } from "@/components/notes/RichNoteEditor";
import { exportNotes, type ExportFormat } from "@/lib/exportNotes";
import { usePref } from "@/lib/prefs";

interface Props {
  course: Course;
  file: CourseFileMeta;
  onUpdated: (f: CourseFileMeta) => void;
  onLocateFolder?: (folderPath: string) => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SPEED_KEY = "course-vault.playbackRate";

export function FileViewer({ course, file, onUpdated, onLocateFolder }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState(file.comment ?? "");
  const [savingComment, setSavingComment] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pathCopied, setPathCopied] = useState(false);
  const [notesLayout, setNotesLayout] = usePref<"horizontal" | "vertical">("notes.layout", "horizontal");
  const [notesVisible, setNotesVisible] = usePref<"on" | "off">("notes.visible", "on");
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = parseFloat(window.localStorage.getItem(SPEED_KEY) ?? "1");
    return Number.isFinite(v) && v > 0 ? v : 1;
  });
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const blobRef = useRef<File | null>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const folderPath = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "";

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(null);
    setComment(file.comment ?? "");

    (async () => {
      try {
        const memFiles = course.source === "memory" ? getCourseFiles(course.id) : undefined;
        const blob = await getFileFromCourse(course.handle, file.path, memFiles);
        if (!active) return;
        blobRef.current = blob;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setLoading(false);
      } catch (e) {
        if (!active) return;
        const msg = (e as Error).message ?? "Erro ao abrir arquivo";
        setError(msg.includes("permission") ? "Permissão de pasta expirada — recarregue a página e autorize de novo." : msg);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [course, file.id, file.path, file.comment]);

  // Apply persisted speed when media element mounts / file changes
  useEffect(() => {
    if (mediaRef.current) mediaRef.current.playbackRate = speed;
  }, [speed, url]);

  const setSpeedAndPersist = (s: number) => {
    setSpeed(s);
    if (mediaRef.current) mediaRef.current.playbackRate = s;
    try { window.localStorage.setItem(SPEED_KEY, String(s)); } catch { /* ignore */ }
  };

  const toggleWatched = async () => {
    const updated = { ...file, watched: !file.watched, watchedAt: !file.watched ? Date.now() : undefined };
    await upsertFile(updated);
    onUpdated(updated);
    toast.success(updated.watched ? "Marcado como assistido" : "Desmarcado");
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
      toast.success("Caminho copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleVideoEnded = async () => {
    if (file.watched) return;
    const updated = { ...file, watched: true, watchedAt: Date.now() };
    await upsertFile(updated);
    onUpdated(updated);
    toast.success("Aula concluída ✓");
  };

  const seekTo = (sec: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = sec;
      mediaRef.current.play().catch(() => { /* ignore */ });
    }
  };

  // Detect [mm:ss] tokens (in plain text view of the HTML) for clickable chips
  const tokens = useMemo(() => parseTimestamps(stripHtml(comment)), [comment]);
  const isMedia = file.kind === "video" || file.kind === "audio";
  const showNotes = notesVisible === "on";

  const handleExport = (format: ExportFormat) => {
    exportNotes(format, {
      filename: `${course.name} - ${file.name.replace(/\.[^.]+$/, "")}`,
      title: file.name,
      html: comment,
    });
    toast.success(`Notas exportadas (${format.toUpperCase()})`);
  };

  return (
    <div className={cn(
      "flex h-full",
      showNotes && notesLayout === "vertical" ? "flex-row" : "flex-col",
    )}>
      <div className="flex min-w-0 flex-1 flex-col">
      {/* File header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground line-clamp-1">
              {folderPath || course.name}
            </p>
            {folderPath && onLocateFolder && (
              <button
                onClick={() => onLocateFolder(folderPath)}
                title="Mostrar pasta na lista"
                className="rounded p-0.5 text-muted-foreground/70 hover:bg-secondary hover:text-foreground"
              >
                <FolderTree className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={copyPath}
              title="Copiar caminho"
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
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotesVisible(showNotes ? "off" : "on")}
            className="h-8 rounded-xl gap-1.5 px-2.5"
            title={showNotes ? "Ocultar anotações" : "Mostrar anotações"}
          >
            {showNotes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{showNotes ? "Ocultar notas" : "Mostrar notas"}</span>
          </Button>
          {showNotes && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNotesLayout(notesLayout === "horizontal" ? "vertical" : "horizontal")}
              className="h-8 rounded-xl gap-1.5 px-2.5 hidden md:inline-flex"
              title={notesLayout === "horizontal" ? "Mover notas para a direita" : "Mover notas para baixo"}
            >
              {notesLayout === "horizontal" ? <Columns2 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={downloadFile} disabled={!url} className="h-8 rounded-xl gap-1.5 px-2.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Baixar</span>
          </Button>
          <Button
            variant={file.watched ? "default" : "outline"}
            size="sm"
            onClick={toggleWatched}
            className={cn("h-8 rounded-xl gap-1.5 px-2.5", file.watched && "bg-success hover:bg-success/90 text-success-foreground")}
          >
            {file.watched ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{file.watched ? "Assistido" : "Marcar assistido"}</span>
          </Button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-auto bg-muted/30">
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
          />
        )}
      </div>
      </div>

      {showNotes && (
        <aside
          className={cn(
            "flex flex-col bg-card",
            notesLayout === "vertical"
              ? "w-full max-w-[420px] shrink-0 border-l border-border"
              : "border-t border-border",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anotações
              {savingComment ? (
                <span className="ml-1 text-[11px] font-normal normal-case tracking-normal text-muted-foreground/70">salvando…</span>
              ) : savedFlash ? (
                <span className="ml-1 flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal text-success">
                  <Check className="h-3 w-3" /> salvo
                </span>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-xs">
                  <FileDown className="h-3.5 w-3.5" />
                  Baixar
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
          <div className="flex-1 overflow-auto px-4 py-3 sm:px-6">
            <RichNoteEditor
              value={comment}
              onChange={handleCommentChange}
              placeholder={isMedia
                ? "Suas notas sobre essa aula… use ‘Marcar tempo’ para inserir [mm:ss] clicáveis."
                : "Suas notas sobre esse material…"}
              onInsertTimestamp={isMedia ? buildTimestampSnippet : undefined}
            />
            {isMedia && tokens.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tokens.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => seekTo(t.seconds)}
                    className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                  >
                    ▶ {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function ViewerContent({
  file, url, onVideoEnded, mediaRef, initialSpeed,
}: {
  file: CourseFileMeta;
  url: string;
  onVideoEnded: () => void;
  mediaRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>;
  initialSpeed: number;
}) {
  if (file.kind === "video") {
    return (
      <div className="flex h-full items-center justify-center bg-black p-0 sm:p-6">
        <video
          key={url}
          ref={(el) => { mediaRef.current = el; if (el) el.playbackRate = initialSpeed; }}
          src={url}
          controls
          className="max-h-full max-w-full rounded-lg shadow-elevated"
          onEnded={onVideoEnded}
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
          ref={(el) => { mediaRef.current = el; if (el) el.playbackRate = initialSpeed; }}
          src={url}
          controls
          className="w-full max-w-md"
          onEnded={onVideoEnded}
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

  const Icon = file.kind === "doc" ? FileText : FileIcon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Icon className="h-16 w-16 text-muted-foreground" strokeWidth={1.5} />
      <div>
        <p className="font-display text-base font-semibold text-foreground">Pré-visualização indisponível</p>
        <p className="mt-1 text-sm text-muted-foreground">Use o botão "Baixar" para abrir esse arquivo.</p>
      </div>
    </div>
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
  // TipTap emits "<p></p>" for an empty doc — treat that as no comment.
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
