import type { CourseFileMeta, FileKind } from "./db";
import { getFileBlob } from "./db";

const VIDEO_EXT = ["mp4", "mkv", "webm", "mov", "m4v", "avi", "ts"];
const AUDIO_EXT = ["mp3", "m4a", "wav", "ogg", "flac"];
const DOC_EXT = ["txt", "md", "rtf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "html", "json", "zip", "rar"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp"];

export function getKind(name: string): FileKind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (VIDEO_EXT.includes(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (DOC_EXT.includes(ext)) return "doc";
  return "other";
}

export interface ScannedFile {
  path: string;
  name: string;
  size: number;
  kind: FileKind;
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  prefix = "",
): Promise<ScannedFile[]> {
  const out: ScannedFile[] = [];
  const iter = (handle as unknown as { values: () => AsyncIterable<FileSystemHandle> }).values();
  for await (const entry of iter) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      const sub = await scanDirectory(entry as FileSystemDirectoryHandle, path);
      out.push(...sub);
    } else {
      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        out.push({ path, name: entry.name, size: file.size, kind: getKind(entry.name) });
      } catch { /* skip */ }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
}

export async function getFileFromCourse(
  rootHandle: FileSystemDirectoryHandle | undefined,
  relPath: string,
  memoryFiles?: Map<string, File>,
  cachedFileId?: string,
): Promise<File> {
  if (cachedFileId) {
    const blob = await getFileBlob(cachedFileId);
    if (!blob) throw new Error("Arquivo em cache não encontrado");
    const name = relPath.split("/").pop() ?? "file";
    return new File([blob], name, { type: blob.type });
  }
  if (memoryFiles) {
    const f = memoryFiles.get(relPath);
    if (!f) throw new Error("Arquivo não disponível na sessão atual");
    return f;
  }
  if (!rootHandle) throw new Error("Pasta do curso não está acessível");
  const parts = relPath.split("/");
  let dir: FileSystemDirectoryHandle = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) dir = await dir.getDirectoryHandle(parts[i]);
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
  return fileHandle.getFile();
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "read",
): Promise<boolean> {
  const h = handle as unknown as {
    queryPermission: (o: { mode: string }) => Promise<PermissionState>;
    requestPermission: (o: { mode: string }) => Promise<PermissionState>;
  };
  const opts = { mode };
  const current = await h.queryPermission(opts);
  if (current === "granted") return true;
  const req = await h.requestPermission(opts);
  return req === "granted";
}

export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function scanFileList(fileList: FileList | File[]): { files: ScannedFile[]; rootName: string; fileMap: Map<string, File> } {
  const arr = Array.from(fileList);
  const fileMap = new Map<string, File>();
  let rootName = "";
  const files: ScannedFile[] = [];
  for (const f of arr) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const parts = rel.split("/");
    if (!rootName && parts.length > 1) rootName = parts[0];
    const path = parts.length > 1 ? parts.slice(1).join("/") : f.name;
    fileMap.set(path, f);
    files.push({ path, name: f.name, size: f.size, kind: getKind(f.name) });
  }
  files.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
  return { files, rootName: rootName || "Curso", fileMap };
}

export function mergeScanWithMeta(
  courseId: string,
  scanned: ScannedFile[],
  existing: CourseFileMeta[],
): CourseFileMeta[] {
  const map = new Map(existing.map((e) => [e.path, e]));
  return scanned.map((s) => {
    const id = `${courseId}::${s.path}`;
    const prev = map.get(s.path);
    return {
      id,
      courseId,
      path: s.path,
      name: s.name,
      kind: s.kind,
      size: s.size,
      watched: prev?.watched ?? false,
      watchedAt: prev?.watchedAt,
      comment: prev?.comment,
      progress: prev?.progress,
    };
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export type SortMode = "natural" | "reverse" | "progress";

/**
 * Compare two files for the "by progress" sort: unwatched first, then watched.
 * Within each bucket, falls back to natural alphanumeric on `name`.
 */
function byProgress(a: { watched: boolean; name: string }, b: { watched: boolean; name: string }) {
  if (a.watched !== b.watched) return a.watched ? 1 : -1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

/** Natural-sort comparator (locale-aware, numeric-aware). */
function naturalCmp(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Build a flat, type-grouped, ordering-preserving list of files for the
 * "Ocultar pastas" view. Files keep the natural order of their parent folder
 * (so course sequence is preserved), but everything is grouped by kind:
 * videos first, then PDFs, then audio, then docs/images/other.
 */
const KIND_ORDER: Record<FileKind, number> = {
  video: 0, pdf: 1, audio: 2, doc: 3, image: 4, other: 5,
};

export function flattenForGroupedView(files: CourseFileMeta[], mode: SortMode): CourseFileMeta[] {
  // 1) Compute each file's position in the natural folder order so we can
  //    reuse it as the secondary sort within each kind bucket.
  const sortedNatural = [...files].sort((a, b) => naturalCmp(a.path, b.path));
  const naturalIndex = new Map(sortedNatural.map((f, i) => [f.id, i]));

  return [...files].sort((a, b) => {
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (mode === "progress" && a.watched !== b.watched) return a.watched ? 1 : -1;
    const idxA = naturalIndex.get(a.id) ?? 0;
    const idxB = naturalIndex.get(b.id) ?? 0;
    return mode === "reverse" ? idxB - idxA : idxA - idxB;
  });
}

/**
 * Build a hierarchical folder tree from a flat list of files.
 * Children at every level are sorted by:
 *   1. folders before files (always)
 *   2. by `mode` — natural / reverse / progress
 */
export function buildTree(files: CourseFileMeta[], mode: SortMode = "natural") {
  type Node = {
    name: string;
    path: string;
    children: Map<string, Node>;
    file?: CourseFileMeta;
  };
  const root: Node = { name: "", path: "", children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
        });
      }
      node = node.children.get(part)!;
      if (isLeaf) node.file = f;
    }
  }

  // Recursively sort children of every node into a stable, ordered Map.
  const sortChildren = (n: Node) => {
    const arr = [...n.children.values()];
    arr.sort((a, b) => {
      // Folders always above files within the same level.
      const aIsFolder = !a.file;
      const bIsFolder = !b.file;
      if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
      if (mode === "progress" && a.file && b.file) return byProgress(a.file, b.file);
      const cmp = naturalCmp(a.name, b.name);
      return mode === "reverse" ? -cmp : cmp;
    });
    n.children = new Map(arr.map((c) => [c.name, c]));
    for (const c of arr) sortChildren(c);
  };
  sortChildren(root);

  return root;
}