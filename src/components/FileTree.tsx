import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, PlayCircle, FileText, FileAudio, FileImage, File as FileIcon, CheckCircle2, MessageSquare } from "lucide-react";
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
}

export function FileTree({ files, selectedId, onSelect }: Props) {
  const root = buildTree(files);
  return (
    <div className="space-y-0.5">
      {Array.from(root.children.values()).map((node) => (
        <TreeNode key={node.path} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

type Node = ReturnType<typeof buildTree>;

function TreeNode({ node, depth, selectedId, onSelect }: { node: Node; depth: number; selectedId: string | null; onSelect: (f: CourseFileMeta) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const isFolder = !node.file;

  if (isFolder) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
          {open ? <FolderOpen className="h-4 w-4 shrink-0 text-primary" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {Array.from(node.children.values()).map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
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