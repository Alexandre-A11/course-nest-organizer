import { Link } from "@tanstack/react-router";
import { Folder, PlayCircle, FileText, MoreVertical, Trash2 } from "lucide-react";
import type { Course, CourseFileMeta } from "@/lib/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Props {
  course: Course;
  files: CourseFileMeta[];
  onDelete: () => void;
}

export function CourseCard({ course, files, onDelete }: Props) {
  const videos = files.filter((f) => f.kind === "video");
  const pdfs = files.filter((f) => f.kind === "pdf");
  const watched = videos.filter((v) => v.watched).length;
  const progress = videos.length ? Math.round((watched / videos.length) * 100) : 0;

  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: course.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated hover:border-primary/30"
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
              <button className="rounded-lg p-1.5 text-white/80 opacity-0 transition-opacity hover:bg-white/20 hover:text-white group-hover:opacity-100">
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