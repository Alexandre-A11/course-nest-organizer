import { Link } from "@tanstack/react-router";
import { Folder, PlayCircle, FileText, MoreVertical, Trash2, ChevronRight } from "lucide-react";
import type { Course, CourseFileMeta } from "@/lib/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CourseViewMode = "grid" | "list" | "compact";

interface Props {
  course: Course;
  files: CourseFileMeta[];
  onDelete: () => void;
  view?: CourseViewMode;
}

export function CourseCard({ course, files, onDelete, view = "grid" }: Props) {
  const videos = files.filter((f) => f.kind === "video");
  const pdfs = files.filter((f) => f.kind === "pdf");
  const watched = videos.filter((v) => v.watched).length;
  const progress = videos.length ? Math.round((watched / videos.length) * 100) : 0;

  if (view === "list") {
    return (
      <Link
        to="/course/$courseId"
        params={{ courseId: course.id }}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white shadow-soft"
          style={{ background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}aa 100%)` }}
        >
          <Folder className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-display text-base font-semibold text-foreground">{course.name}</h3>
            {course.description && (
              <span className="truncate text-xs text-muted-foreground">— {course.description}</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><PlayCircle className="h-3 w-3" /> {videos.length}</span>
            <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> {pdfs.length}</span>
            <span>•</span>
            <span>{files.length} arquivo{files.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="hidden w-44 shrink-0 sm:block">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-display font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-hero transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <RowActions onDelete={onDelete} />
        <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
      </Link>
    );
  }

  if (view === "compact") {
    return (
      <Link
        to="/course/$courseId"
        params={{ courseId: course.id }}
        className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}aa 100%)` }}
          >
            <Folder className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-sm font-semibold text-foreground">{course.name}</h3>
            <p className="truncate text-[11px] text-muted-foreground">{videos.length}v · {pdfs.length}p · {progress}%</p>
          </div>
          <RowActions onDelete={onDelete} compact />
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-hero" style={{ width: `${progress}%` }} />
        </div>
      </Link>
    );
  }

  // grid (default)
  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: course.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
    >
      <div
        className="relative h-28 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}aa 60%, ${course.color}55 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)" }}
        />
        <Folder className="absolute right-4 top-4 h-12 w-12 text-white/40" strokeWidth={1.5} />
        <div className="absolute right-2 top-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <button className={cn(
                "rounded-lg p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-white/20 hover:text-white group-hover:opacity-100",
              )}>
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remover curso
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight text-foreground line-clamp-1">
            {course.name}
          </h3>
          {course.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{course.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <PlayCircle className="h-3.5 w-3.5" />
            {videos.length} vídeo{videos.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {pdfs.length} PDF{pdfs.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-auto space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Progresso</span>
            <span className="font-display font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-hero transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function RowActions({ onDelete, compact = false }: { onDelete: () => void; compact?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
        <button className={cn(
          "rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
          compact ? "p-1" : "p-1.5",
        )}>
          <MoreVertical className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem
          onClick={(e) => { e.preventDefault(); onDelete(); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remover curso
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
