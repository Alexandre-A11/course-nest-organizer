import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, X, FolderOpen, Loader2, Settings2 } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import {
  saveCourse, upsertFiles, deleteCourseBlobs, listFiles,
  type Course,
} from "@/lib/db";
import {
  isFsAccessSupported, scanDirectory, scanFileList, mergeScanWithMeta, getKind,
} from "@/lib/fs";
import { setCourseFiles } from "@/lib/sessionFiles";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCENT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;

interface Props {
  course: Course | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: (c: Course) => void;
}

export function EditCourseDialog({ course, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>(ACCENT_COLORS[0]);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [manageCats, setManageCats] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderFallbackRef = useRef<HTMLInputElement>(null);
  const cats = useCategories();
  const supported = isFsAccessSupported();

  // Pending folder change (applied on save).
  const [pendingHandle, setPendingHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [pendingMemoryFiles, setPendingMemoryFiles] = useState<Map<string, File> | null>(null);
  const [pendingRootName, setPendingRootName] = useState<string>("");
  const [pendingFileCount, setPendingFileCount] = useState(0);

  useEffect(() => {
    if (!course) return;
    setName(course.name);
    setDescription(course.description ?? "");
    setCategory(course.category);
    setColor(course.color);
    setBanner(course.banner);
    setPendingHandle(null);
    setPendingMemoryFiles(null);
    setPendingRootName("");
    setPendingFileCount(0);
  }, [course, open]);

  const handleBannerPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BANNER_BYTES) {
      toast.error("Imagem muito grande (máx. 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBanner(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => toast.error("Não foi possível ler a imagem");
    reader.readAsDataURL(f);
  };

  const pickNewFolder = async () => {
    if (!supported) {
      folderFallbackRef.current?.click();
      return;
    }
    try {
      // @ts-expect-error showDirectoryPicker
      const dir = (await window.showDirectoryPicker({ mode: "read" })) as FileSystemDirectoryHandle;
      setRelinking(true);
      const scanned = await scanDirectory(dir);
      setPendingHandle(dir);
      setPendingMemoryFiles(null);
      setPendingFileCount(scanned.length);
      setRelinking(false);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Não foi possível abrir a pasta");
      setRelinking(false);
    }
  };

  const handleFallbackFolderPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list || list.length === 0) return;
    const { files, rootName, fileMap } = scanFileList(list);
    setPendingMemoryFiles(fileMap);
    setPendingHandle(null);
    setPendingRootName(rootName);
    setPendingFileCount(files.length);
  };

  const submit = async () => {
    if (!course || !name.trim()) return;
    setSaving(true);

    // Build the updated course, applying pending folder change if any.
    let updated: Course = {
      ...course,
      name: name.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      color,
      banner,
    };

    if (pendingHandle) {
      updated = { ...updated, source: "handle", handle: pendingHandle, rootName: undefined };
      const scanned = await scanDirectory(pendingHandle);
      const existing = await listFiles(course.id);
      const merged = mergeScanWithMeta(course.id, scanned, existing);
      await upsertFiles(merged);
      // Drop any stale cached blobs
      await deleteCourseBlobs(course.id);
    } else if (pendingMemoryFiles) {
      updated = {
        ...updated,
        source: "memory",
        handle: undefined,
        rootName: pendingRootName || course.rootName,
      };
      setCourseFiles(course.id, pendingMemoryFiles);
      const scanned = Array.from(pendingMemoryFiles.entries()).map(([path, f]) => ({
        path, name: f.name, size: f.size, kind: getKind(f.name),
      }));
      const existing = await listFiles(course.id);
      const merged = mergeScanWithMeta(course.id, scanned, existing);
      await upsertFiles(merged);
      // Drop any legacy cached blobs to free disk space.
      await deleteCourseBlobs(course.id);
    }

    await saveCourse(updated);
    setSaving(false);
    toast.success("Curso atualizado");
    onSaved(updated);
    onOpenChange(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Editar curso</DialogTitle>
          <DialogDescription>Personalize título, categoria, banner e pasta.</DialogDescription>
        </DialogHeader>

        {/* Banner */}
        <div className="space-y-2">
          <Label>Banner</Label>
          <div
            className="relative h-32 overflow-hidden rounded-xl border border-border"
            style={!banner ? {
              background: `linear-gradient(135deg, ${color} 0%, ${color}aa 60%, ${color}55 100%)`,
            } : undefined}
          >
            {banner && <img src={banner} alt="Banner" className="h-full w-full object-cover" />}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 p-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="h-7 gap-1 rounded-lg text-xs">
                <ImagePlus className="h-3.5 w-3.5" />
                {banner ? "Trocar" : "Adicionar imagem"}
              </Button>
              {banner && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setBanner(undefined)} className="h-7 gap-1 rounded-lg text-xs">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleBannerPick} />
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="edit-name">Nome do curso</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="edit-desc">Descrição (opcional)</Label>
          <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-xl resize-none" />
        </div>

        {/* Folder relink */}
        <div className="space-y-2">
          <Label>Pasta do curso</Label>
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {pendingHandle || pendingMemoryFiles
                ? <span className="text-foreground"><strong>Nova pasta:</strong> {pendingHandle?.name ?? pendingRootName} — {pendingFileCount} arquivos</span>
                : <>Atual: <strong className="text-foreground">{course?.handle?.name ?? course?.rootName ?? course?.name}</strong></>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={pickNewFolder} disabled={relinking} className="h-8 gap-1.5 rounded-lg text-xs">
                {relinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                {pendingHandle || pendingMemoryFiles ? "Trocar novamente" : "Alterar pasta"}
              </Button>
              {(pendingHandle || pendingMemoryFiles) && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPendingHandle(null); setPendingMemoryFiles(null); setPendingFileCount(0); }} className="h-8 gap-1 rounded-lg text-xs">
                  <X className="h-3.5 w-3.5" /> Cancelar troca
                </Button>
              )}
            </div>
            <input
              ref={folderFallbackRef}
              type="file"
              // @ts-expect-error webkitdirectory non-standard
              webkitdirectory=""
              directory=""
              multiple
              hidden
              onChange={handleFallbackFolderPick}
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Categoria</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setManageCats(true)} className="h-7 gap-1 rounded-lg px-2 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Gerenciar
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
              Nenhuma
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
          <Label>Cor de destaque</Label>
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
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!name.trim() || saving} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ManageCategoriesDialog open={manageCats} onOpenChange={setManageCats} />
    </>
  );
}
