import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FolderPlus, Loader2, Info, ImagePlus, Trash2, X,
  Settings2, Folder, ChevronRight, FolderTree, Check,
} from "lucide-react";
import { mergeScanWithMeta, getKind } from "@/lib/fs";
import { saveCourse, upsertFiles, type Course } from "@/lib/db";
import {
  getServerUrl, listServerFolders, scanServerFolder, type RemoteFolder,
} from "@/lib/syncClient";
import { useCategories } from "@/hooks/use-categories";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ACCENT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;

interface Props {
  onAdded: () => void;
}

export function AddCourseDialog({ onAdded }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [remoteParent, setRemoteParent] = useState<string>("");
  const [serverFolders, setServerFolders] = useState<RemoteFolder[] | null>(null);
  const [remoteFolder, setRemoteFolder] = useState<string | null>(null);
  const [remoteFolderName, setRemoteFolderName] = useState<string>("");
  const [remoteFileCount, setRemoteFileCount] = useState(0);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>(ACCENT_COLORS[0]);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [manageCats, setManageCats] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const cats = useCategories();

  useEffect(() => {
    if (!open) return;
    setColor((prev) => prev || ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]);
  }, [open]);

  const reset = () => {
    setName(""); setDescription(""); setCategory(undefined); setBanner(undefined);
    setRemoteFolder(null); setRemoteFolderName(""); setRemoteFileCount(0);
    setRemoteParent("");
    setColor(ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]);
  };

  // Refresh server availability + folder list on open.
  useEffect(() => {
    if (!open) return;
    const u = getServerUrl();
    setServerUrl(u);
    if (u) {
      setLoadingFolders(true);
      listServerFolders("")
        .then((f) => setServerFolders(f))
        .catch(() => setServerFolders([]))
        .finally(() => setLoadingFolders(false));
    } else {
      setServerFolders(null);
    }
  }, [open]);

  const navigateInto = async (folderPath: string) => {
    setRemoteParent(folderPath);
    setLoadingFolders(true);
    try {
      const list = await listServerFolders(folderPath);
      setServerFolders(list);
    } catch {
      setServerFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const pickRemoteFolder = async (folder: RemoteFolder) => {
    setRemoteFolder(folder.path);
    setRemoteFolderName(folder.name);
    if (!name) setName(folder.name);
    try {
      const { files } = await scanServerFolder(folder.path);
      setRemoteFileCount(files.length);
    } catch {
      setRemoteFileCount(0);
      toast.error(t("toast.openErr"));
    }
  };

  const pickCurrentAsCourse = async () => {
    if (!remoteParent) return;
    const segs = remoteParent.split("/");
    await pickRemoteFolder({
      name: segs[segs.length - 1],
      path: remoteParent,
      hasChildren: false,
    });
  };

  const breadcrumbs = remoteParent
    ? remoteParent.split("/").map((seg, idx, arr) => ({
        label: seg,
        path: arr.slice(0, idx + 1).join("/"),
      }))
    : [];

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
    if (!remoteFolder || !name.trim()) return;
    setSubmitting(true);
    const id = crypto.randomUUID();
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }

    const course: Course = {
      id,
      name: name.trim(),
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
    const scannedCount = metas.length;

    setSubmitting(false);
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

        {!serverUrl && (
          <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p>{t("add.noServer") /* fallback message handled below */}</p>
          </div>
        )}

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

        {/* Remote folder picker (only mode now) */}
        <div className="space-y-2">
          <Label>{t("add.remoteLabel")}</Label>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => navigateInto("")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-secondary",
                !remoteParent && "font-semibold text-foreground",
              )}
            >
              <FolderTree className="h-3 w-3" /> /courses
            </button>
            {breadcrumbs.map((b, i) => (
              <span key={b.path} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navigateInto(b.path)}
                      className={cn(
                        "max-w-[140px] truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-secondary",
                        i === breadcrumbs.length - 1 && "font-semibold text-foreground",
                      )}
                    >
                      {b.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[420px] break-all">
                    /{b.path}
                  </TooltipContent>
                </Tooltip>
              </span>
            ))}
            {remoteParent && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={pickCurrentAsCourse}
                className={cn(
                  "ml-auto h-6 gap-1 rounded-md px-2 text-[11px]",
                  remoteFolder === remoteParent && "border-primary/40 bg-primary-soft text-primary",
                )}
                title={t("add.remotePickCurrent")}
              >
                {remoteFolder === remoteParent ? <Check className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                {t("add.remotePickCurrentShort")}
              </Button>
            )}
          </div>
          <div className="rounded-xl border border-border bg-muted/30">
            {!serverUrl ? (
              <p className="p-4 text-sm text-muted-foreground">
                {t("add.remoteNoServer")}
              </p>
            ) : loadingFolders ? (
              <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t("add.remoteLoading")}
              </div>
            ) : !serverFolders || serverFolders.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {remoteParent ? t("add.remoteEmptySub") : t("add.remoteEmpty")}
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {serverFolders.map((f) => (
                  <div
                    key={f.path}
                    className={cn(
                      "flex items-center gap-1 border-b border-border/50 px-2 py-1.5 transition-colors last:border-b-0",
                      remoteFolder === f.path && "bg-primary-soft/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => pickRemoteFolder(f)}
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-primary-soft/40",
                        remoteFolder === f.path && "text-primary",
                      )}
                      title={t("add.remotePickFolder")}
                    >
                      {remoteFolder === f.path ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Folder className="h-4 w-4 text-primary" />
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex-1 min-w-0 truncate">{f.name}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[420px] break-all">
                          <span className="block font-medium">{f.name}</span>
                          <span className="block text-[10px] opacity-80">/{f.path}</span>
                        </TooltipContent>
                      </Tooltip>
                      {remoteFolder === f.path && (
                        <span className="text-xs text-muted-foreground">
                          {t("field.filesFound", { n: remoteFileCount, plural: remoteFileCount !== 1 ? "s" : "" })}
                        </span>
                      )}
                    </button>
                    {f.hasChildren && (
                      <button
                        type="button"
                        onClick={() => navigateInto(f.path)}
                        title={t("add.remoteOpenFolder")}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="px-1 text-xs text-muted-foreground">{t("add.remoteHint")}</p>
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

        {/* Used name to avoid unused-var warning when switching layouts */}
        {remoteFolderName && <input type="hidden" value={remoteFolderName} readOnly />}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
            {t("btn.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!remoteFolder || !name.trim() || submitting || !serverUrl}
            className="rounded-xl"
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("btn.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ManageCategoriesDialog open={manageCats} onOpenChange={setManageCats} />
    </>
  );
}
