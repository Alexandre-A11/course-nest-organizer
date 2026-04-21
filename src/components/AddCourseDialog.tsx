import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FolderPlus, FolderOpen, Loader2, AlertTriangle } from "lucide-react";
import { isFsAccessSupported, scanDirectory, mergeScanWithMeta } from "@/lib/fs";
import { saveCourse, upsertFiles, type Course } from "@/lib/db";
import { toast } from "sonner";

const ACCENT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

interface Props {
  onAdded: () => void;
}

export function AddCourseDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [scanning, setScanning] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const supported = isFsAccessSupported();

  const reset = () => {
    setName(""); setDescription(""); setHandle(null); setFileCount(0);
  };

  const pickFolder = async () => {
    try {
      // @ts-expect-error showDirectoryPicker
      const dir = (await window.showDirectoryPicker({ mode: "read" })) as FileSystemDirectoryHandle;
      setHandle(dir);
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

  const submit = async () => {
    if (!handle || !name.trim()) return;
    setScanning(true);
    const id = crypto.randomUUID();
    const course: Course = {
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      createdAt: Date.now(),
      handle,
      color: ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
    };
    await saveCourse(course);
    const scanned = await scanDirectory(handle);
    const metas = mergeScanWithMeta(id, scanned, []);
    await upsertFiles(metas);
    setScanning(false);
    setOpen(false);
    reset();
    onAdded();
    toast.success(`Curso "${course.name}" adicionado com ${metas.length} arquivos`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 rounded-xl shadow-elevated">
          <FolderPlus className="h-4 w-4" />
          Adicionar curso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Novo curso</DialogTitle>
          <DialogDescription>
            Selecione a pasta do curso no seu computador. Nada é enviado pra nuvem.
          </DialogDescription>
        </DialogHeader>

        {!supported && (
          <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Seu navegador não suporta acesso a pastas. Use Chrome, Edge ou Brave atualizados.</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Pasta do curso</Label>
            <button
              type="button"
              onClick={pickFolder}
              disabled={!supported || scanning}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FolderOpen className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                {handle ? (
                  <>
                    <p className="truncate text-sm font-medium text-foreground">{handle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {scanning ? "Escaneando..." : `${fileCount} arquivo${fileCount !== 1 ? "s" : ""} encontrado${fileCount !== 1 ? "s" : ""}`}
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-name">Nome do curso</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: React Avançado"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="course-desc">Descrição (opcional)</Label>
            <Textarea
              id="course-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anotações sobre o curso..."
              rows={3}
              className="rounded-xl resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!handle || !name.trim() || scanning} className="rounded-xl">
            {scanning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar curso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}