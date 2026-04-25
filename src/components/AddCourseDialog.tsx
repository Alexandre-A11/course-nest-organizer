import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  FolderPlus, FolderOpen, Loader2, Info, ImagePlus, Trash2, X,
  Settings2, HardDrive, Server, Folder,
} from "lucide-react";
import {
  isFsAccessSupported, scanDirectory, scanFileList, mergeScanWithMeta, getKind,
} from "@/lib/fs";
import {
  saveCourse, upsertFiles, putFileBlobs, type Course,
} from "@/lib/db";
import {
  getServerUrl, listServerFolders, scanServerFolder,
} from "@/lib/syncClient";
import { setCourseFiles } from "@/lib/sessionFiles";
import { useCategories } from "@/hooks/use-categories";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCENT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;

interface Props {
  onAdded: () => void;
}

export function AddCourseDialog({ onAdded }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"local" | "remote">("local");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [serverFolders, setServerFolders] = useState<{ name: string }[] | null>(null);
  const [remoteFolder, setRemoteFolder] = useState<string | null>(null);
  const [remoteFileCount, setRemoteFileCount] = useState(0);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>(ACCENT_COLORS[0]);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [memoryFiles, setMemoryFiles] = useState<Map<string, File> | null>(null);
  const [rootName, setRootName] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  /** When true (only meaningful in non-FSA browsers), copy files into IDB. */
  const [keepOffline, setKeepOffline] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [manageCats, setManageCats] = useState(false);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const supported = isFsAccessSupported();
  const cats = useCategories();

  useEffect(() => {
    if (!open) return;
    setColor((prev) => prev || ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]);
  }, [open]);

  const reset = () => {
    setName(""); setDescription(""); setHandle(null); setMemoryFiles(null);
    setRootName(""); setFileCount(0); setCategory(undefined); setBanner(undefined);
    setKeepOffline(false); setProgressMsg(null);
    setRemoteFolder(null); setRemoteFileCount(0);
    setColor(ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]);
  };

  // When opening, refresh server availability + folder list.
  useEffect(() => {
    if (!open) return;
    const u = getServerUrl();
    setServerUrl(u);
    if (u) {
      setLoadingFolders(true);
      listServerFolders()
        .then((f) => setServerFolders(f))
        .catch(() => setServerFolders([]))
        .finally(() => setLoadingFolders(false));
    } else {
      setMode("local");
      setServerFolders(null);
    }
  }, [open]);

  const pickRemoteFolder = async (folder: string) => {
    setRemoteFolder(folder);
    if (!name) setName(folder);
    try {
      const { files } = await scanServerFolder(folder);
      setRemoteFileCount(files.length);
    } catch {
      setRemoteFileCount(0);
      toast.error(t("toast.openErr"));
    }
  };

  const pickFolder = async () => {
    if (!supported) {
      fallbackInputRef.current?.click();
      return;
    }
    try {
      // @ts-expect-error showDirectoryPicker
      const dir = (await window.showDirectoryPicker({ mode: "read" })) as FileSystemDirectoryHandle;
      setHandle(dir);
      setMemoryFiles(null);
      if (!name) setName(dir.name);
      setScanning(true);
      const scanned = await scanDirectory(dir);
      setFileCount(scanned.length);
      setScanning(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error(t("toast.openErr"));
      }
      setScanning(false);
    }
  };

  const handleFallbackPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setScanning(true);
    const { files, rootName: rn, fileMap } = scanFileList(list);
    setMemoryFiles(fileMap);
    setHandle(null);
    setRootName(rn);
    if (!name) setName(rn);
    setFileCount(files.length);
    setScanning(false);
  };

  const handleBannerPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BANNER_BYTES) {
      toast.error(t("toast.imgTooBig"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBanner(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => toast.error(t("toast.imgErr"));
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (mode === "local" && (!handle && !memoryFiles)) return;
    if (mode === "remote" && !remoteFolder) return;
    if (!name.trim()) return;
    setScanning(true);
    const id = crypto.randomUUID();

    // Try to request persistent storage so blobs survive browser eviction.
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }

    let scannedCount = 0;

    if (mode === "remote" && remoteFolder) {
      const course: Course = {
        id, name: name.trim(),
        description: description.trim() || undefined,
        createdAt: Date.now(),
        source: "remote",
        remoteFolder,
        color,
        category: category || undefined,
        banner,
      };
      await saveCourse(course);
      const { files } = await scanServerFolder(remoteFolder);
      const metas = mergeScanWithMeta(id, files.map((f) => ({
        path: f.path, name: f.name, size: f.size, kind: getKind(f.name),
      })), []);
      await upsertFiles(metas);
      scannedCount = metas.length;
    } else if (handle) {
      const course: Course = {
        id, name: name.trim(),
        description: description.trim() || undefined,
        createdAt: Date.now(),
        source: "handle", handle, color,
        category: category || undefined,
        banner,
      };
      await saveCourse(course);
      const scanned = await scanDirectory(handle);
      const metas = mergeScanWithMeta(id, scanned, []);
      await upsertFiles(metas);
      scannedCount = metas.length;
    } else if (memoryFiles) {
      const useCache = keepOffline;
      const course: Course = {
        id, name: name.trim(),
        description: description.trim() || undefined,
        createdAt: Date.now(),
        source: useCache ? "cached" : "memory",
        rootName, color,
        category: category || undefined,
        banner,
      };
      await saveCourse(course);
      // Always keep session map for instant access this session (memory mode
      // needs it; cached mode benefits from it as a same-session shortcut).
      setCourseFiles(id, memoryFiles);
      const scanned = Array.from(memoryFiles.entries()).map(([path, f]) => ({
        path, name: f.name, size: f.size, kind: getKind(f.name),
      }));
      const metas = mergeScanWithMeta(id, scanned, []);
      await upsertFiles(metas);
      scannedCount = metas.length;

      if (useCache) {
        setProgressMsg(t("add.cacheCopying"));
        // Persist blobs in chunks to keep transactions small.
        const entries: { id: string; courseId: string; blob: Blob }[] = [];
        for (const m of metas) {
          const f = memoryFiles.get(m.path);
          if (f) entries.push({ id: m.id, courseId: id, blob: f });
        }
        const CHUNK = 25;
        for (let i = 0; i < entries.length; i += CHUNK) {
          await putFileBlobs(entries.slice(i, i + CHUNK));
        }
        toast.success(t("add.cachedDone", { n: entries.length }));
      }
    }

    setScanning(false);
    setProgressMsg(null);
    setOpen(false);
    reset();
    onAdded();
    toast.success(t("toast.added", { name: name.trim(), n: scannedCount }));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 rounded-xl shadow-elevated">
          <FolderPlus className="h-4 w-4" />
          {t("btn.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.subtitle")}</DialogDescription>
        </DialogHeader>

        {!supported && (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary-soft/40 p-3 text-sm text-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p>{t("field.fsCompat")}</p>
          </div>
        )}

        {/* Mode tabs (only shown when a server is configured) */}
        {serverUrl && (
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setMode("local")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "local"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <HardDrive className="h-3.5 w-3.5" /> {t("add.modeLocal")}
            </button>
            <button
              type="button"
              onClick={() => setMode("remote")}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "remote"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Server className="h-3.5 w-3.5" /> {t("add.modeRemote")}
            </button>
          </div>
        )}

        <input
          ref={fallbackInputRef}
          type="file"
          // @ts-expect-error webkitdirectory non-standard
          webkitdirectory=""
          directory=""
          multiple
          hidden
          onChange={handleFallbackPick}
        />

        {/* Banner */}
        <div className="space-y-2">
          <Label>{t("field.bannerOpt")}</Label>
          <div
            className="relative h-28 overflow-hidden rounded-xl border border-border"
            style={!banner ? {
              background: `linear-gradient(135deg, ${color} 0%, ${color}aa 60%, ${color}55 100%)`,
            } : undefined}
          >
            {banner && <img src={banner} alt="Banner" className="h-full w-full object-cover" />}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => bannerInputRef.current?.click()}
                className="h-7 gap-1 rounded-lg text-xs"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {banner ? t("field.bannerChange") : t("field.bannerAdd")}
              </Button>
              {banner && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setBanner(undefined)} className="h-7 gap-1 rounded-lg text-xs">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <input ref={bannerInputRef} type="file" accept="image/*" hidden onChange={handleBannerPick} />
        </div>

        {/* Folder */}
        <div className="space-y-2">
          <Label>{t("field.folder")}</Label>
          <button
            type="button"
            onClick={pickFolder}
            disabled={scanning}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen className="h-5 w-5 text-primary" />
            <div className="flex-1 min-w-0">
              {handle || memoryFiles ? (
                <>
                  <p className="truncate text-sm font-medium text-foreground">{handle?.name ?? rootName}</p>
                  <p className="text-xs text-muted-foreground">
                    {scanning
                      ? t("field.scanning")
                      : t("field.filesFound", { n: fileCount, plural: fileCount !== 1 ? "s" : "" })}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">{t("field.folderPick")}</p>
                  <p className="text-xs text-muted-foreground">{t("field.folderPickHint")}</p>
                </>
              )}
            </div>
            {scanning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </button>

          {memoryFiles && (
            <p className="px-1 text-xs text-muted-foreground">{t("field.fsHint")}</p>
          )}

          {memoryFiles && !supported && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="keep-offline" className="cursor-pointer text-sm font-medium">
                    {t("add.cacheToggle")}
                  </Label>
                  <Switch
                    id="keep-offline"
                    checked={keepOffline}
                    onCheckedChange={setKeepOffline}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("add.cacheHint")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="course-name">{t("field.name")}</Label>
          <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("field.namePh")} className="rounded-xl" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="course-desc">{t("field.desc")}</Label>
          <Textarea id="course-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("field.descPh")} rows={2} className="rounded-xl resize-none" />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("field.category")}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setManageCats(true)} className="h-7 gap-1 rounded-lg px-2 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              {t("field.manage")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory(undefined)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                !category
                  ? "border-primary/40 bg-primary-soft text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <X className="h-3.5 w-3.5" />
              {t("field.categoryNone")}
            </button>
            {cats.map((cat) => {
              const Icon = cat.icon;
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", !active && cat.color)} />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color */}
        <div className="space-y-2">
          <Label>{t("field.color")}</Label>
          <div className="flex flex-wrap gap-1.5">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-7 w-7 rounded-lg ring-2 ring-offset-2 ring-offset-background transition-transform",
                  color === c ? "ring-foreground scale-110" : "ring-transparent hover:scale-105",
                )}
                style={{ background: c }}
                aria-label={t("field.colorAria", { c })}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
            {t("btn.cancel")}
          </Button>
          <Button onClick={submit} disabled={(!handle && !memoryFiles) || !name.trim() || scanning} className="rounded-xl">
            {scanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {scanning && progressMsg ? progressMsg : t("btn.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ManageCategoriesDialog open={manageCats} onOpenChange={setManageCats} />
    </>
  );
}
