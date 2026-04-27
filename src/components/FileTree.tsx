import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ChevronRight, Folder, FolderOpen, PlayCircle, FileText, FileAudio, FileImage,
  File as FileIcon, CheckCircle2, MessageSquare, X, GripVertical,
} from "lucide-react";
import type { CourseFileMeta, FileKind } from "@/lib/db";
import { buildTree } from "@/lib/fs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  /** Custom drag-and-drop order map keyed by item path. */
  customOrder?: Record<string, number>;
  /** Called whenever the user drags items into a new order. */
  onReorder?: (next: Record<string, number>) => void;
  /** Multi-selection set (file ids). */
  selectedIds?: Set<string>;
  /** Called with click metadata so the parent can do range/toggle selection. */
  onMultiSelect?: (file: CourseFileMeta, mods: { ctrl: boolean; shift: boolean }) => void;
}

export function FileTree({
  files, selectedId, onSelect, flat = false, focusFolder = null, onSetFocusFolder,
  highlightFolder, customOrder, onReorder, selectedIds, onMultiSelect,
}: Props) {
  // Filter by focused folder
  const visible = useMemo(() => {
    if (!focusFolder) return files;
    const prefix = focusFolder.endsWith("/") ? focusFolder : focusFolder + "/";
    return files.filter((f) => f.path === focusFolder || f.path.startsWith(prefix));
  }, [files, focusFolder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  if (flat) {
    // In flat view, the whole list is a single sortable container.
    const ids = visible.map((f) => f.id);
    const handleDragEnd = (e: DragEndEvent) => {
      if (!onReorder || !e.over || e.active.id === e.over.id) return;
      const oldIdx = ids.indexOf(String(e.active.id));
      const newIdx = ids.indexOf(String(e.over.id));
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(visible, oldIdx, newIdx);
      const next: Record<string, number> = { ...(customOrder ?? {}) };
      reordered.forEach((f, i) => { next[f.path] = i; });
      onReorder(next);
    };
    return (
      <div className="space-y-0.5">
        {focusFolder && (
          <FocusBanner folder={focusFolder} onClear={() => onSetFocusFolder?.(null)} />
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {visible.map((file) => (
              <SortableFlatItem
                key={file.id}
                file={file}
                selectedId={selectedId}
                onClick={handleClick}
                isMultiSelected={selectedIds?.has(file.id) ?? false}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  const root = buildTree(visible);
  const topLevelChildren = Array.from(root.children.values());
  const topLevelIds = topLevelChildren.map((n) => n.path);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!onReorder || !e.over || e.active.id === e.over.id) return;
    const oldIdx = topLevelIds.indexOf(String(e.active.id));
    const newIdx = topLevelIds.indexOf(String(e.over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(topLevelChildren, oldIdx, newIdx);
    const next: Record<string, number> = { ...(customOrder ?? {}) };
    reordered.forEach((n, i) => { next[n.path] = i; });
    onReorder(next);
  };

  return (
    <div className="space-y-0.5">
      {focusFolder && (
        <FocusBanner folder={focusFolder} onClear={() => onSetFocusFolder?.(null)} />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelIds} strategy={verticalListSortingStrategy}>
          {topLevelChildren.map((node) => (
            <SortableTreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedId={selectedId}
              onClick={handleClick}
              onFocusFolder={onSetFocusFolder}
              highlightFolder={highlightFolder ?? null}
              selectedIds={selectedIds}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
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

function SortableFlatItem({
  file, selectedId, onClick, isMultiSelected,
}: {
  file: CourseFileMeta;
  selectedId: string | null;
  onClick: (f: CourseFileMeta, e: React.MouseEvent) => void;
  isMultiSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: file.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const Icon = KIND_ICON[file.kind];
  const isActive = file.id === selectedId;
  const folder = file.path.includes("/") ? file.path.split("/").slice(0, -1).join("/") : "";
  return (
    <div
      ref={setNodeRef}
      style={style}
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
      <span
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
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

function SortableTreeNode(props: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onClick: (f: CourseFileMeta, e: React.MouseEvent) => void;
  onFocusFolder?: (folder: string | null) => void;
  highlightFolder: string | null;
  selectedIds?: Set<string>;
}) {
  // Only the top level uses sortable wrapping (depth === 0). Nested nodes
  // render the existing TreeNode directly (folder hierarchy is preserved as
  // a logical structure; reordering happens at the level the user drags).
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.node.path,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <TreeNode
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function TreeNode({
  node, depth, selectedId, onClick, onFocusFolder, highlightFolder, selectedIds,
  dragHandleProps,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onClick: (f: CourseFileMeta, e: React.MouseEvent) => void;
  onFocusFolder?: (folder: string | null) => void;
  highlightFolder: string | null;
  selectedIds?: Set<string>;
  dragHandleProps?: Record<string, unknown>;
}) {
  const { t } = useI18n();
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
          {dragHandleProps && (
            <span
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical className="h-3 w-3" />
            </span>
          )}
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
      {dragHandleProps && (
        <span
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-3 w-3" />
        </span>
      )}
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : KIND_COLOR[file.kind])} />
      <span className={cn("flex-1 truncate", file.watched && !isActive && "line-through opacity-60", isActive && "font-medium")}>
        {file.name}
      </span>
      {file.comment && <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />}
      {file.watched && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />}
    </div>
  );
}
