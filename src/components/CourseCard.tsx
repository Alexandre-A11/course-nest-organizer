import { Link } from "@tanstack/react-router";
import { Folder, PlayCircle, FileText, MoreVertical, Trash2, ChevronRight, Pencil, Play, Star, RotateCcw } from "lucide-react";
import type { Course, CourseFileMeta } from "@/lib/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getCategory } from "@/lib/categories";
import { useI18n, plural } from "@/lib/i18n";

export type CourseViewMode = "grid" | "list" | "compact";

interface Props {
  course: Course;
  files: CourseFileMeta[];
  onDelete: () => void;
  onEdit?: () => void;
  onToggleFavorite?: () => void;
  view?: CourseViewMode;
}

export function CourseCard({ course, files, onDelete, onEdit, onToggleFavorite, view = "grid" }: Props) {
  const { t, lang } = useI18n();
  const videos = files.filter((f) => f.kind === "video");
  const pdfs = files.filter((f) => f.kind === "pdf");
  const watched = videos.filter((v) => v.watched).length;
  const progress = videos.length ? Math.round((watched / videos.length) * 100) : 0;
  const category = getCategory(course.category);
  const CatIcon = category?.icon;
  const hasContinue = !!course.lastFileId && files.some((f) => f.id === course.lastFileId);
  const isFav = !!course.favorite;
  const favTitle = isFav ? t("home.favoriteRemove") : t("home.favoriteAdd");
  const handleFavClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.();
  };

  if (view === "list") {
    return (
      <Link
        to="/course/$courseId"
        params={{ courseId: course.id }}
        className="group flex items-center gap-3 border-b border-border/40 px-2 py-2.5 transition-colors hover:bg-muted/40"
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md text-white"
          style={course.banner
            ? undefined
            : { background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}aa 100%)` }}
        >
          {course.banner ? (
            <img src={course.banner} alt="" className="h-full w-full object-cover" />
          ) : CatIcon ? (
            <CatIcon className="h-4 w-4" strokeWidth={1.8} />
          ) : (
            <Folder className="h-4 w-4" strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FavStar isFav={isFav} title={favTitle} onClick={handleFavClick} />
            <h3 className="truncate text-sm font-medium text-foreground">{course.name}</h3>
            {category && (
              <span className="shrink-0 rounded-sm border border-border/60 px-1.5 py-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {category.name}
              </span>
            )}
          </div>
        </div>
        <div className="hidden items-center gap-3 font-mono text-[11px] tabular-nums text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1"><PlayCircle className="h-3 w-3" />{videos.length}</span>
          <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{pdfs.length}</span>
        </div>
        <div className="hidden w-40 shrink-0 items-center gap-2 sm:flex">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/60">
            <div className="h-full bg-foreground/70 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="w-9 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <RowActions onDelete={onDelete} onEdit={onEdit} />
        <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
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
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white"
            style={course.banner ? undefined : { background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}aa 100%)` }}
          >
            {course.banner ? (
              <img src={course.banner} alt="" className="h-full w-full object-cover" />
            ) : CatIcon ? (
              <CatIcon className="h-4 w-4" strokeWidth={1.8} />
            ) : (
              <Folder className="h-4 w-4" strokeWidth={1.8} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <FavStar isFav={isFav} title={favTitle} onClick={handleFavClick} compact />
              {category && (
                <category.icon className={cn("h-3 w-3 shrink-0", category.color)} />
              )}
              <h3 className="truncate font-display text-sm font-semibold text-foreground">{course.name}</h3>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{videos.length}v · {pdfs.length}p · {progress}%</p>
          </div>
          <RowActions onDelete={onDelete} onEdit={onEdit} compact />
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-hero" style={{ width: `${progress}%` }} />
        </div>
      </Link>
    );
  }

  // grid
  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: course.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-card/90 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
    >
      <div
        className="relative h-28 overflow-hidden"
        style={course.banner ? undefined : {
          background: `linear-gradient(135deg, ${course.color} 0%, ${course.color}aa 60%, ${course.color}55 100%)`,
        }}
      >
        {course.banner && (
          <img src={course.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!course.banner && (
          <div className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6) 0%, transparent 50%)" }}
          />
        )}
        {category ? (
          <span
            title={category.name}
            className="absolute left-3 top-3 inline-flex items-center justify-center rounded-lg bg-black/35 p-1.5 text-white backdrop-blur-sm"
          >
            <category.icon className="h-4 w-4" />
          </span>
        ) : null}
        {!course.banner && (
          <Folder className="absolute right-4 top-4 h-12 w-12 text-white/40" strokeWidth={1.5} />
        )}
        {course.author && (
          <span className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-md bg-black/20 px-1.5 py-0.5 font-mono text-xs italic tracking-wide text-white/70 backdrop-blur-sm">
            {course.author}
          </span>
        )}
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {onToggleFavorite && (
            <button
              onClick={handleFavClick}
              title={favTitle}
              className={cn(
                "rounded-lg p-1.5 backdrop-blur-sm transition-colors",
                isFav
                  ? "bg-yellow-400/90 text-yellow-900 hover:bg-yellow-300"
                  : "bg-black/30 text-white/90 hover:bg-white/20 hover:text-white",
              )}
            >
              <Star className={cn("h-4 w-4", isFav && "fill-current")} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <button className={cn(
                "rounded-lg bg-black/30 p-1.5 text-white/90 opacity-0 backdrop-blur-sm transition-opacity hover:bg-white/20 hover:text-white group-hover:opacity-100",
              )}>
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("btn.edit")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => { e.preventDefault(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("btn.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div>
          <h3 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground">
            {course.name}
          </h3>
          {course.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{course.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px] tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <PlayCircle className="h-3.5 w-3.5" />
            {videos.length}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            {pdfs.length}
          </span>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider">
            <span className="font-semibold text-muted-foreground">{t("card.progress")}</span>
            <span className={cn(
              "font-mono tabular-nums",
              progress === 100 ? "text-emerald-500" : progress > 0 ? "text-primary" : "text-muted-foreground",
            )}>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="pt-1.5">
            <div className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
              progress === 100
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                : progress > 0
                  ? "border-primary/30 bg-primary-soft/40 text-primary"
                  : "border-border bg-background/40 text-foreground hover:bg-secondary",
            )}>
              {progress === 100 ? (
                <><RotateCcw className="h-3.5 w-3.5" /> {t("card.action.review")}</>
              ) : progress > 0 || hasContinue ? (
                <><Play className="h-3.5 w-3.5 fill-current" /> {t("card.action.continue")}</>
              ) : (
                <><Play className="h-3.5 w-3.5 fill-current" /> {t("card.action.start")}</>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RowActions({ onDelete, onEdit, compact = false }: { onDelete: () => void; onEdit?: () => void; compact?: boolean }) {
  const { t } = useI18n();
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
        {onEdit && (
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit(); }}>
            <Pencil className="mr-2 h-4 w-4" />
            {t("btn.edit")}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(e) => { e.preventDefault(); onDelete(); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("btn.delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FavStar({
  isFav, title, onClick, compact = false,
}: { isFav: boolean; title: string; onClick: (e: React.MouseEvent) => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "shrink-0 rounded-md transition-colors",
        compact ? "p-0.5" : "p-1",
        isFav ? "text-yellow-500 hover:text-yellow-400" : "text-muted-foreground/60 hover:text-yellow-500",
      )}
    >
      <Star className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", isFav && "fill-current")} />
    </button>
  );
}
