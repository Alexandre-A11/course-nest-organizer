import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  FolderPlus, FolderOpen, Loader2, Info, ImagePlus, Trash2, X,
} from "lucide-react";
import {
  isFsAccessSupported, scanDirectory, scanFileList, mergeScanWithMeta,
  getBrowserInfo, getKind,
} from "@/lib/fs";
import {
  saveCourse, upsertFiles, putFileBlobs, type Course,
} from "@/lib/db";
import { setCourseFiles } from "@/lib/sessionFiles";
import { useCategories } from "@/hooks/use-categories";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const ACCENT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
const MAX_BANNER_BYTES = 2 * 1024 * 1024;

interface Props {
  onAdded: () => void;
}

export function AddCourseDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>(ACCENT_COLORS[0]);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [memoryFiles, setMemoryFiles] = useState<Map<string, File> | null>(null);
  const [rootName, setRootName] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [persistOffline, setPersistOffline] = useState(true);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const supported = isFsAccessSupported();
  const browser = getBrowserInfo();
  const cats = useCategories();

  useEffect(() => {
    if (!open) return;
    setColor((prev) => prev || ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]);
  }, [open]);

  const reset = () => {
    setName(""); setDescription(""); setHandle(null); setMemoryFiles(null);
    setRootName(""); setFileCount(0); setCategory(undefined); setBanner(undefined);
    setColor(ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)]);
    setPersistOffline(true); setProgress(null);
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
        toast.error("Não foi possível abrir a pasta");
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
      toast.error("Imagem muito grande (máx. 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBanner(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => toast.error("Não foi possível ler a imagem");
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if ((!handle && !memoryFiles) || !name.trim()) return;
    setScanning(true);
    const id = crypto.randomUUID();

    // Try to request persistent storage so blobs survive browser eviction.
    try { await navigator.storage?.persist?.(); } catch { /* ignore */ }

    let scannedCount = 0;

    if (handle) {
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
      const useCache = persistOffline;
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
      // Always keep session map for instant access this session.
      setCourseFiles(id, memoryFiles);
      const scanned = Array.from(memoryFiles.entries()).map(([path, f]) => ({
        path, name: f.name, size: f.size, kind: getKind(f.name),
      }));
      const metas = mergeScanWithMeta(id, scanned, []);
      await upsertFiles(metas);
      scannedCount = metas.length;

      if (useCache) {
        // Persist blobs to IndexedDB so the user doesn't need to re-pick.
        const entries = metas.map((m) => ({
          id: m.id,
          courseId: id,
          blob: memoryFiles.get(m.path)!,
        })).filter((e) => e.blob);
        // Chunk to keep transactions reasonable.
        const CHUNK = 25;
        setProgress({ current: 0, total: entries.length });
        for (let i = 0; i < entries.length; i += CHUNK) {
          const slice = entries.slice(i, i + CHUNK);
          try {
            await putFileBlobs(slice);
          } catch (e) {
            toast.error("Espaço de armazenamento esgotado — modo offline desativado.");
            // Downgrade to memory mode
            await saveCourse({ ...course, source: "memory" });
            break;
          }
          setProgress({ current: Math.min(i + CHUNK, entries.length), total: entries.length });
        }
      }
    }

    setProgress(null);
    setScanning(false);
    setOpen(false);
    reset();
    onAdded();
    toast.success(`Curso "${name.trim()}" adicionado com ${scannedCount} arquivos`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 rounded-xl shadow-elevated">
          <FolderPlus className="h-4 w-4" />
          Adicionar curso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Novo curso</DialogTitle>
          <DialogDescription>
            Selecione a pasta do curso. Tudo fica no seu dispositivo.
          </DialogDescription>
        </DialogHeader>

        {!supported && (
          <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary-soft/40 p-3 text-sm text-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p>
              {browser.name === "Firefox" ? "Firefox" : "Seu navegador"} usa modo compatível.
              Ative <strong>“Manter offline”</strong> abaixo para não precisar reselecionar a pasta a cada sessão.
            </p>
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
          <Label>Banner (opcional)</Label>
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
                {banner ? "Trocar" : "Adicionar imagem"}
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
          <Label>Pasta do curso</Label>
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
                    {scanning && progress
                      ? `Salvando offline ${progress.current}/${progress.total}...`
                      : scanning
                        ? "Escaneando..."
                        : `${fileCount} arquivo${fileCount !== 1 ? "s" : ""} encontrado${fileCount !== 1 ? "s" : ""}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">Escolher pasta</p>
                  <p className="text-xs text-muted-foreground">Clique para selecionar</p>
                </>
              )}
            </div>
            {scanning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </button>

          {/* Persist offline toggle (only relevant for fallback/memory mode) */}
          {memoryFiles && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <Switch
                id="persist-offline"
                checked={persistOffline}
                onCheckedChange={setPersistOffline}
              />
              <div className="flex-1">
                <Label htmlFor="persist-offline" className="cursor-pointer text-sm">
                  Manter disponível offline
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Salva os arquivos no navegador (IndexedDB) — você não precisa reselecionar a pasta a cada sessão.
                  Ocupa espaço em disco.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="course-name">Nome do curso</Label>
          <Input id="course-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: React Avançado" className="rounded-xl" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="course-desc">Descrição (opcional)</Label>
          <Textarea id="course-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anotações sobre o curso..." rows={2} className="rounded-xl resize-none" />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Categoria</Label>
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
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={(!handle && !memoryFiles) || !name.trim() || scanning} className="rounded-xl">
            {scanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar curso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
