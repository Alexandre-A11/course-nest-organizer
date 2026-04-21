import type { CourseFileMeta, FileKind } from "./db";

const VIDEO_EXT = ["mp4", "mkv", "webm", "mov", "m4v", "avi"];
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
  // @ts-expect-error - values() exists on FileSystemDirectoryHandle
  for await (const entry of handle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "directory") {
      const sub = await scanDirectory(entry as FileSystemDirectoryHandle, path);
      out.push(...sub);
    } else {
      try {
        const file = await (entry as FileSystemFileHandle).getFile();
        out.push({
          path,
          name: entry.name,
          size: file.size,
          kind: getKind(entry.name),
        });
      } catch {
        // skip unreadable
      }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
}

export async function getFileFromCourse(
  rootHandle: FileSystemDirectoryHandle,
  relPath: string,
): Promise<File> {
  const parts = relPath.split("/");
  let dir: FileSystemDirectoryHandle = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
  return fileHandle.getFile();
}

export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite" = "read",
): Promise<boolean> {
  // @ts-expect-error - non-standard but widely supported
  const opts = { mode };
  // @ts-expect-error
  const current = await handle.queryPermission(opts);
  if (current === "granted") return true;
  // @ts-expect-error
  const req = await handle.requestPermission(opts);
  return req === "granted";
}

export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
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

export function buildTree(files: CourseFileMeta[]) {
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
  return root;
}