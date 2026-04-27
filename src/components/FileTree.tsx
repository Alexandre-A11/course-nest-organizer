import { useEffect, useMemo, useCallback } from "react";
import {
  ChevronRight, Folder, FolderOpen, PlayCircle, FileText, FileAudio, FileImage,
  File as FileIcon, CheckCircle2, MessageSquare, X, ArrowDownAZ, ArrowUpAZ, ListChecks,
  ChevronsDownUp, ChevronsUpDown, FolderCheck,
} from "lucide-react";
import type { CourseFileMeta, FileKind } from "@/lib/db";
import { buildTree, flattenForGroupedView, type SortMode } from "@/lib/fs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const KIND_ICON: Record<FileKind, typeof FileIcon> = {
  video: PlayCircle,
  pdf: FileText,
  audio: FileAudio,
  image: FileImage,
  doc: FileText,
  other: FileIcon,
};

const KIND_COLOR: Record<FileKind, string> = {
  video: "text-primary",
  pdf: "text-rose-500",
  audio: "text-violet-500",
  image: "text-amber-500",
  doc: "text-slate-500",
  other: "text-muted-foreground",
};

interface Props {
  files: CourseFileMeta[];
  selectedId: string | null;
  onSelect: (file: CourseFileMeta) => void;
  /** Hide folder structure — render a flat, type-grouped list instead. */
  flat?: boolean;
  /** Only show files inside this folder path (and its subfolders). */
  focusFolder?: string | null;
  onSetFocusFolder?: (folder: string | null) => void;
  /** External signal to expand & scroll to a folder. */
  highlightFolder?: string | null;
  /** Multi-selection set (file ids). */
  selectedIds?: Set<string>;
  /** Called with click metadata so the parent can do range/toggle selection. */
  onMultiSelect?: (file: CourseFileMeta, mods: { ctrl: boolean; shift: boolean }) => void;
  /** Sort mode (controlled). */
  sortMode?: SortMode;
  onSortModeChange?: (mode: SortMode) => void;
  /** Persisted set of expanded folder paths. */
  expandedFolders?: string[];
  onExpandedFoldersChange?: (paths: string[]) => void;
}

export function FileTree({
  files, selectedId, onSelect, flat = false, focusFolder = null, onSetFocusFolder,
  highlightFolder, selectedIds, onMultiSelect,
  sortMode = "natural", onSortModeChange,
  expandedFolders, onExpandedFoldersChange,
}: Props) {
  const { t } = useI18n();

  // Filter by focused folder
  const visible = useMemo(() => {
    if (!focusFolder) return files;
    const prefix = focusFolder.endsWith("/") ? focusFolder : focusFolder + "/";
    return files.filter((f) => f.path === focusFolder || f.path.startsWith(prefix));
  }, [files, focusFolder]);

  const handleClick = useCallback((file: CourseFileMeta, e: React.MouseEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    if ((ctrl || shift) && onMultiSelect) {
      e.preventDefault();
      onMultiSelect(file, { ctrl, shift });
      return;
    }
    onSelect(file);
  }, [onSelect, onMultiSelect]);

  // Collect every folder path so Expand All / Collapse All can operate on them.
  const allFolderPaths = useMemo(() => {
    const set = new Set<string>();
    for (const f of visible) {
      const parts = f.path.split("/");
      for (let i = 1; i < parts.length; i++) set.add(parts.slice(0, i).join("/"));
    }
    return Array.from(set);
  }, [visible]);

  const expandedSet = useMemo(() => new Set(expandedFolders ?? []), [expandedFolders]);

  /**
   * Map of folder path → completion stats so we can flag fully-watched
   * folders with a check icon. A folder is "complete" only when it contains
   * at least one file and every descendant file is `watched`.
   */
  const folderProgress = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const f of visible) {
      const parts = f.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        const p = parts.slice(0, i).join("/");
        const cur = map.get(p) ?? { total: 0, done: 0 };
        cur.total += 1;
        if (f.watched) cur.done += 1;
        map.set(p, cur);
      }
    }
    return map;
  }, [visible]);

  const toggleFolder = (path: string) => {
    if (!onExpandedFoldersChange) return;
    const next = new Set(expandedSet);
    if (next.has(path)) next.delete(path); else next.add(path);
    onExpandedFoldersChange(Array.from(next));
  };

  const expandAll = () => onExpandedFoldersChange?.(allFolderPaths);
  /**
   * Fully recursive collapse: even when sub-folders had been previously
   * expanded, an empty array now wins because TreeNode no longer auto-opens
   * top-level entries when the persisted set is empty.
   */
  const collapseAll = () => onExpandedFoldersChange?.([]);

  const sortMenu = (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-xs" title={t("course.sort")}>
            {sortMode === "reverse" ? <ArrowUpAZ className="h-3.5 w-3.5" />
              : sortMode === "progress" ? <ListChecks className="h-3.5 w-3.5" />
                : <ArrowDownAZ className="h-3.5 w-3.5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t("course.sort")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sortMode} onValueChange={(v) => onSortModeChange?.(v as SortMode)}>
            <DropdownMenuRadioItem value="natural"><ArrowDownAZ className="mr-2 h-3.5 w-3.5" />{t("course.sortNatural")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="reverse"><ArrowUpAZ className="mr-2 h-3.5 w-3.5" />{t("course.sortReverse")}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="progress"><ListChecks className="mr-2 h-3.5 w-3.5" />{t("course.sortProgress")}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          {!flat && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={expandAll}><ChevronsUpDown className="mr-2 h-3.5 w-3.5" />{t("course.expandAll")}</DropdownMenuItem>
              <DropdownMenuItem onClick={collapseAll}><ChevronsDownUp className="mr-2 h-3.5 w-3.5" />{t("course.collapseAll")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (flat) {
    const items = flattenForGroupedView(visible, sortMode);
    // Render small section labels when the kind changes.
    let lastKind: FileKind | null = null;
    return (
      <div className="space-y-0.5">
        <div className="mb-1 flex items-center justify-end">{sortMenu}</div>
        {focusFolder && (
          <FocusBanner folder={focusFolder} onClear={() => onSetFocusFolder?.(null)} />
        )}
        {items.map((file) => {
          const showHeader = file.kind !== lastKind;
          lastKind = file.kind;
          return (
            <div key={file.id}>
              {showHeader && (
                <div className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {kindLabel(file.kind, t)}
                </div>
              )}
              <FlatItem
                file={file}
                selectedId={selectedId}
                onClick={handleClick}
                isMultiSelected={selectedIds?.has(file.id) ?? false}
              />
            </div>
          );
        })}
      </div>
    );
  }

  const root = buildTree(visible, sortMode);
  const topLevelChildren = Array.from(root.children.values());

  return (
    <div className="space-y-0.5">
      <div className="mb-1 flex items-center justify-end">{sortMenu}</div>
      {focusFolder && (
        <FocusBanner folder={focusFolder} onClear={() => onSetFocusFolder?.(null)} />
      )}
      {topLevelChildren.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedId={selectedId}
          onClick={handleClick}
          onFocusFolder={onSetFocusFolder}
          highlightFolder={highlightFolder ?? null}
          selectedIds={selectedIds}
          expandedSet={expandedSet}
          onToggleFolder={toggleFolder}
          folderProgress={folderProgress}
        />
      ))}
    </div>
  );
}

function kindLabel(kind: FileKind, t: (k: string) => string) {
  switch (kind) {
    case "video": return t("course.filterVideos");
    case "pdf": return t("course.filterPdfs");
    case "audio": return "Audio";
    case "doc": return "Docs";
    case "image": return "Images";
    default: return "Other";
  }
}

function FocusBanner({ folder, onClear }: { folder: string; onClear: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-1.5">
      <div className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">
        {t("course.showingOnly")} <span className="font-semibold">{folder}</span>
      </div>
      <button onClick={onClear} className="rounded p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function FlatItem({
  file, selectedId, onClick, isMultiSelected,
}: {
  file: CourseFileMeta;
  selectedId: string | null;
  onClick: (f: CourseFileMeta, e: React.MouseEvent) => void;
  isMultiSelected: boolean;
}) {
  const Icon = KIND_ICON[file.kind];
  const isActive = file.id === selectedId;
  const folder = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "";
  return (
    <div
      onClick={(e) => onClick(file, e)}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        isMultiSelected
          ? "bg-primary/15 ring-1 ring-primary/40 text-foreground"
          : isActive
            ? "bg-primary-soft text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : KIND_COLOR[file.kind])} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate", file.watched && !isActive && "line-through opacity-60", isActive && "font-medium text-foreground")}>
          {file.name}
        </span>
        {folder && (
          <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {folder}
          </span>
        )}
      </span>
      {file.comment && <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />}
      {file.watched && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
    </div>
  );
}

type Node = ReturnType<typeof buildTree>;

function TreeNode({
  node, depth, selectedId, onClick, onFocusFolder, highlightFolder, selectedIds,
  expandedSet, onToggleFolder, folderProgress,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onClick: (f: CourseFileMeta, e: React.MouseEvent) => void;
  onFocusFolder?: (folder: string | null) => void;
  highlightFolder: string | null;
  selectedIds?: Set<string>;
  expandedSet: Set<string>;
  onToggleFolder: (path: string) => void;
  folderProgress: Map<string, { total: number; done: number }>;
}) {
  const { t } = useI18n();
  const isFolder = !node.file;

  // Folder open state: persisted set is the single source of truth so
  // "Collapse all" can fully close every level (including top-level folders).
  const open = isFolder ? expandedSet.has(node.path) : false;

  const isHighlighted = highlightFolder === node.path;
  const containsHighlight = isFolder && highlightFolder
    ? (highlightFolder === node.path || highlightFolder.startsWith(node.path + "/"))
    : false;

  // If a folder needs to be highlighted from outside, ensure it's expanded.
  useEffect(() => {
    if (containsHighlight && !expandedSet.has(node.path)) {
      onToggleFolder(node.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containsHighlight]);

  if (isFolder) {
    const stats = folderProgress.get(node.path);
    const completed = !!stats && stats.total > 0 && stats.done === stats.total;
    return (
      <div>
        <div
          className={cn(
            "group flex items-center gap-1.5 rounded-lg pr-1 transition-colors",
            isHighlighted ? "bg-primary-soft ring-1 ring-primary/30" : "hover:bg-secondary",
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <button
            onClick={() => onToggleFolder(node.path)}
            className="flex flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-sm font-medium text-foreground"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
            {completed ? (
              <FolderCheck className="h-4 w-4 shrink-0 text-success" />
            ) : open ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className={cn("truncate", completed && "text-success")}>{node.name}</span>
            {completed && (
              <CheckCircle2 className="h-3 w-3 shrink-0 text-success/80" />
            )}
          </button>
          {onFocusFolder && (
            <button
              onClick={(e) => { e.stopPropagation(); onFocusFolder(node.path); }}
              title={t("course.focusFolder")}
              className="rounded p-1 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:bg-background hover:text-primary"
            >
              <FolderOpen className="h-3 w-3" />
            </button>
          )}
        </div>
        {open && (
          <div>
            {Array.from(node.children.values()).map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onClick={onClick}
                onFocusFolder={onFocusFolder}
                highlightFolder={highlightFolder}
                selectedIds={selectedIds}
                expandedSet={expandedSet}
                onToggleFolder={onToggleFolder}
                folderProgress={folderProgress}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const file = node.file!;
  const Icon = KIND_ICON[file.kind];
  const isActive = file.id === selectedId;
  const isMultiSelected = selectedIds?.has(file.id) ?? false;

  return (
    <div
      onClick={(e) => onClick(file, e)}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        isMultiSelected
          ? "bg-primary/15 ring-1 ring-primary/40 text-foreground"
          : isActive
            ? "bg-primary-soft text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : KIND_COLOR[file.kind])} />
      <span className={cn("flex-1 truncate", file.watched && !isActive && "line-through opacity-60", isActive && "font-medium")}>
        {file.name}
      </span>
      {file.comment && <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />}
      {file.watched && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
    </div>
  );
}
