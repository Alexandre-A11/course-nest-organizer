import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImagePlus, Trash2, X, Loader2, Settings2, RotateCcw, AlertTriangle } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { Checkbox } from "@/components/ui/checkbox";
import {
  saveCourse, resetCourseProgress,
  type Course,
} from "@/lib/db";
import { ManageCategoriesDialog } from "@/components/ManageCategoriesDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>(ACCENT_COLORS[0]);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [manageCats, setManageCats] = useState(false);
  const [showDanger, setShowDanger] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [keepNotes, setKeepNotes] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cats = useCategories();

  useEffect(() => {
    if (!course) return;
    setName(course.name);
    setDescription(course.description ?? "");
    setCategory(course.category);
    setColor(course.color);
    setBanner(course.banner);
    setShowDanger(false);
  }, [course, open]);

  const handleBannerPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    toast.success(t("toast.updated"));
    onSaved(updated);
    onOpenChange(false);
  };

  const doReset = async () => {
    if (!course) return;
    setResetting(true);
    try {
      await resetCourseProgress(course.id, keepNotes);
      toast.success(t("reset.done"));
      setConfirmReset(false);
      onSaved({ ...course, lastFileId: undefined, lastAccessedAt: undefined });
      onOpenChange(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("edit.title")}</DialogTitle>
          <DialogDescription>{t("edit.subtitle")}</DialogDescription>
        </DialogHeader>

        {/* Banner */}
        <div className="space-y-2">
          <Label>{t("field.banner")}</Label>
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
                {banner ? t("field.bannerChange") : t("field.bannerAdd")}
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
          <Label htmlFor="edit-name">{t("field.name")}</Label>
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="edit-desc">{t("field.desc")}</Label>
          <Textarea id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-xl resize-none" />
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

        {/* Danger zone (collapsed) */}
        <div className="border-t border-border/60 pt-3">
          {!showDanger ? (
            <button
              type="button"
              onClick={() => setShowDanger(true)}
              className="text-xs text-muted-foreground/70 underline-offset-2 hover:text-destructive hover:underline"
            >
              {t("reset.section")} ↓
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground">{t("reset.hint")}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmReset(true)}
                    className="h-8 gap-1.5 rounded-lg border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t("reset.button")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t("btn.cancel")}
          </Button>
          <Button onClick={submit} disabled={!name.trim() || saving} className="rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("btn.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ManageCategoriesDialog open={manageCats} onOpenChange={setManageCats} />

    <AlertDialog open={confirmReset} onOpenChange={(o) => !o && setConfirmReset(false)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{t("reset.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("reset.body", { name: course?.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              checked={keepNotes}
              onCheckedChange={(v) => setKeepNotes(v === true)}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block font-medium text-foreground">{t("reset.keepNotes")}</span>
              <span className="block text-xs text-muted-foreground">{t("reset.keepNotesHint")}</span>
            </span>
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">{t("btn.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={doReset}
            disabled={resetting}
            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("reset.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
