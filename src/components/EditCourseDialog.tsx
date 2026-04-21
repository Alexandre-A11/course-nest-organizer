import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, X } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { saveCourse, type Course } from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCENT_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];
const MAX_BANNER_BYTES = 2 * 1024 * 1024; // 2MB

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!course) return;
    setName(course.name);
    setDescription(course.description ?? "");
    setCategory(course.category);
    setColor(course.color);
    setBanner(course.banner);
  }, [course]);

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

  const submit = async () => {
    if (!course || !name.trim()) return;
    setSaving(true);
    const updated: Course = {
      ...course,
      name: name.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      color,
      banner,
    };
    await saveCourse(updated);
    setSaving(false);
    toast.success("Curso atualizado");
    onSaved(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Editar curso</DialogTitle>
          <DialogDescription>Personalize título, categoria e banner.</DialogDescription>
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 gap-1 rounded-lg text-xs"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {banner ? "Trocar" : "Adicionar imagem"}
              </Button>
              {banner && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setBanner(undefined)}
                  className="h-7 gap-1 rounded-lg text-xs"
                >
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
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="edit-desc">Descrição (opcional)</Label>
          <Textarea
            id="edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="rounded-xl resize-none"
          />
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
            {CATEGORIES.map((cat) => {
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
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}