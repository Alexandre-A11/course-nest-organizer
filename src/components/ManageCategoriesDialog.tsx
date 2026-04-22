import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, X, RotateCcw } from "lucide-react";
import {
  CATEGORY_ICONS, CATEGORY_COLORS, addCustomCategory, removeCustomCategory,
  restoreBuiltinCategory, getRemovedBuiltins,
} from "@/lib/categories";
import { useCategories } from "@/hooks/use-categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ManageCategoriesDialog({ open, onOpenChange }: Props) {
  const cats = useCategories();
  const [name, setName] = useState("");
  const [iconName, setIconName] = useState<string>("Sparkles");
  const [color, setColor] = useState<string>(CATEGORY_COLORS[0].value);

  const create = () => {
    if (!name.trim()) return;
    addCustomCategory({ name, iconName, color });
    setName("");
    toast.success("Categoria criada");
  };

  const remove = (id: string, label: string) => {
    removeCustomCategory(id);
    toast.success(`"${label}" removida`);
  };

  const restore = (id: string, label: string) => {
    restoreBuiltinCategory(id);
    toast.success(`"${label}" restaurada`);
  };

  const removedBuiltins = getRemovedBuiltins();
  const SelectedIcon = CATEGORY_ICONS[iconName];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Gerenciar categorias</DialogTitle>
          <DialogDescription>Crie e remova categorias personalizadas.</DialogDescription>
        </DialogHeader>

        {/* Create */}
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> Nova categoria
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-name" className="text-xs">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marketing"
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CATEGORY_ICONS).map((key) => {
                const Icon = CATEGORY_ICONS[key];
                const active = iconName === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIconName(key)}
                    title={key}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                      active
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cor do ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((c) => {
                const Icon = SelectedIcon;
                const active = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.name}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-card transition-all",
                      active ? "border-foreground scale-110" : "border-border",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", c.value)} />
                  </button>
                );
              })}
            </div>
          </div>
          <Button onClick={create} disabled={!name.trim()} className="w-full rounded-xl">
            Adicionar categoria
          </Button>
        </div>

        {/* All categories */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Suas categorias ({cats.length})
          </div>
          {cats.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma categoria. Crie uma acima.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {cats.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <Icon className={cn("h-3.5 w-3.5", c.color)} />
                    <span className="font-medium text-foreground">{c.name}</span>
                    <button
                      onClick={() => remove(c.id, c.name)}
                      className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Removed built-ins (restorable) */}
        {removedBuiltins.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Padrão removidas ({removedBuiltins.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {removedBuiltins.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => restore(c.id, c.name)}
                    title="Restaurar"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-foreground"
                  >
                    <Icon className={cn("h-3.5 w-3.5", c.color)} />
                    <span>{c.name}</span>
                    <RotateCcw className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="rounded-xl gap-1.5">
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
