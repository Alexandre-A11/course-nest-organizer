import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Folder, FolderOpen, PlayCircle, FileText, FileAudio, FileImage, File as FileIcon, CheckCircle2, MessageSquare, X } from "lucide-react";
import type { CourseFileMeta, FileKind } from "@/lib/db";
import { buildTree } from "@/lib/fs";
import { cn } from "@/lib/utils";

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
  /** Hide folder structure — render a flat list instead. */
  flat?: boolean;
  /** Only show files inside this folder path (and its subfolders). */
  focusFolder?: string | null;
  onSetFocusFolder?: (folder: string | null) => void;
  /** External signal to expand & scroll to a folder. */
  highlightFolder?: string | null;
}

export function FileTree({ files, selectedId, onSelect, flat = false, focusFolder = null, onSetFocusFolder, highlightFolder }: Props) {
  // Filter by focused folder
  const visible = useMemo(() => {
    if (!focusFolder) return files;
    const prefix = focusFolder.endsWith("/") ? focusFolder : focusFolder + "/";
    return files.filter((f) => f.path === focusFolder || f.path.startsWith(prefix));
  }, [files, focusFolder]);

  if (flat) {
    return (
      <div className="space-y-0.5">
        {focusFolder && (
          <FocusBanner folder={focusFolder} onClear={() => onSetFocusFolder?.(null)} />
        )}
        {visible.map((file) => (
          <FlatItem key={file.id} file={file} selectedId={selectedId} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  const root = buildTree(visible);
  return (
    <div className="space-y-0.5">
      {focusFolder && (
        <FocusBanner folder={focusFolder} onClear={() => onSetFocusFolder?.(null)} />
      )}
      {Array.from(root.children.values()).map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onFocusFolder={onSetFocusFolder}
          highlightFolder={highlightFolder ?? null}
        />
      ))}
    </div>
  );
}

function FocusBanner({ folder, onClear }: { folder: string; onClear: () => void }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-1.5">
      <div className="min-w-0 flex-1 truncate text-[11px] font-medium text-primary">
        Mostrando apenas: <span className="font-semibold">{folder}</span>
      </div>
      <button onClick={onClear} className="rounded p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function FlatItem({ file, selectedId, onSelect }: { file: CourseFileMeta; selectedId: string | null; onSelect: (f: CourseFileMeta) => void }) {
  const Icon = KIND_ICON[file.kind];
  const isActive = file.id === selectedId;
  const folder = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "";
  return (
    <button
      onClick={() => onSelect(file)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        isActive ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
    </button>
  );
}

type Node = ReturnType<typeof buildTree>;

function TreeNode({
  node, depth, selectedId, onSelect, onFocusFolder, highlightFolder,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (f: CourseFileMeta) => void;
  onFocusFolder?: (folder: string | null) => void;
  highlightFolder: string | null;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = !node.file;

  // Auto-expand & flash if highlighted folder is this one or a descendant
  const isHighlighted = highlightFolder === node.path;
  const containsHighlight = isFolder && highlightFolder ? (highlightFolder === node.path || highlightFolder.startsWith(node.path + "/")) : false;

  useEffect(() => {
    if (containsHighlight && !open) setOpen(true);
  }, [containsHighlight]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isFolder) {
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
            onClick={() => setOpen(!open)}
            className="flex flex-1 items-center gap-1.5 px-1 py-1.5 text-left text-sm font-medium text-foreground"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
            {open ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{node.name}</span>
          </button>
          {onFocusFolder && (
            <button
              onClick={(e) => { e.stopPropagation(); onFocusFolder(node.path); }}
              title="Focar nessa pasta"
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
                onSelect={onSelect}
                onFocusFolder={onFocusFolder}
                highlightFolder={highlightFolder}
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

  return (
    <button
      onClick={() => onSelect(file)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        isActive ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : KIND_COLOR[file.kind])} />
      <span className={cn("flex-1 truncate", file.watched && !isActive && "line-through opacity-60", isActive && "font-medium")}>
        {file.name}
      </span>
      {file.comment && <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />}
      {file.watched && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
    </button>
  );
}
