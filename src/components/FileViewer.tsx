import { useEffect, useRef, useState } from "react";
import type { Course, CourseFileMeta } from "@/lib/db";
import { upsertFile } from "@/lib/db";
import { getFileFromCourse, formatBytes } from "@/lib/fs";
import { getCourseFiles } from "@/lib/sessionFiles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Circle, Download, FileText, FileAudio, FileImage, File as FileIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  course: Course;
  file: CourseFileMeta;
  onUpdated: (f: CourseFileMeta) => void;
}

export function FileViewer({ course, file, onUpdated }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState(file.comment ?? "");
  const [savingComment, setSavingComment] = useState(false);
  const blobRef = useRef<File | null>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const updated = { ...file, comment: val.trim() || undefined };
      await upsertFile(updated);
      onUpdated(updated);
      setSavingComment(false);
    }, 600);
  };

  const downloadFile = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  };

  const handleVideoEnded = async () => {
    if (file.watched) return;
    const updated = { ...file, watched: true, watchedAt: Date.now() };
    await upsertFile(updated);
    onUpdated(updated);
    toast.success("Aula concluída ✓");
  };

  return (
    <div className="flex h-full flex-col">
      {/* File header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-6 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {file.path.includes("/") ? file.path.split("/").slice(0, -1).join(" / ") : course.name}
          </p>
          <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight text-foreground line-clamp-1">
            {file.name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadFile} disabled={!url} className="rounded-xl gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Baixar
          </Button>
          <Button
            variant={file.watched ? "default" : "outline"}
            size="sm"
            onClick={toggleWatched}
            className={cn("rounded-xl gap-1.5", file.watched && "bg-success hover:bg-success/90 text-success-foreground")}
          >
            {file.watched ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {file.watched ? "Assistido" : "Marcar assistido"}
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
          <ViewerContent file={file} url={url!} onVideoEnded={handleVideoEnded} />
        )}
      </div>

      {/* Comment */}
      <div className="border-t border-border bg-card px-6 py-4">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="comment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comentários e anotações
          </label>
          {savingComment && <span className="text-xs text-muted-foreground">salvando...</span>}
        </div>
        <Textarea
          id="comment"
          value={comment}
          onChange={(e) => handleCommentChange(e.target.value)}
          placeholder="Suas notas sobre essa aula..."
          rows={3}
          className="rounded-xl resize-none"
        />
      </div>
    </div>
  );
}

function ViewerContent({ file, url, onVideoEnded }: { file: CourseFileMeta; url: string; onVideoEnded: () => void }) {
  if (file.kind === "video") {
    return (
      <div className="flex h-full items-center justify-center bg-black p-0 sm:p-6">
        <video
          key={url}
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
        <audio src={url} controls className="w-full max-w-md" onEnded={onVideoEnded} />
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

  // doc/other — fallback
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