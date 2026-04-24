import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, X, Loader2, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { exportLibrary, importLibrary, type LibraryBackupV1 } from "@/lib/db";
import {
  getCustomCategoriesRaw, getRemovedBuiltinIds, importCategoryState,
} from "@/lib/categories";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported?: () => void;
}

export function BackupDialog({ open, onOpenChange, onImported }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    setBusy("export");
    try {
      const backup = await exportLibrary({
        customCategories: getCustomCategoriesRaw(),
        removedBuiltins: getRemovedBuiltinIds(),
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `course-vault-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("toast.exportOk"));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file: File) => {
    setBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as LibraryBackupV1 & {
        customCategories?: unknown;
        removedBuiltins?: string[];
      };
      const n = await importLibrary(parsed);
      // Categories
      importCategoryState({
        custom: Array.isArray(parsed.customCategories)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (parsed.customCategories as any[])
          : undefined,
        removedBuiltins: parsed.removedBuiltins,
      });
      toast.success(t("toast.importOk", { n }));
      onImported?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error(t("toast.importErr"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("backup.title")}</DialogTitle>
          <DialogDescription>{t("backup.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Export */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Download className="h-4 w-4 text-primary" />
              {t("backup.exportSection")}
            </div>
            <p className="text-xs text-muted-foreground">{t("backup.exportDesc")}</p>
            <Button
              onClick={doExport}
              disabled={busy !== null}
              className="w-full rounded-xl gap-2"
            >
              {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("backup.exportBtn")}
            </Button>
          </div>

          {/* Import */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Upload className="h-4 w-4 text-primary" />
              {t("backup.importSection")}
            </div>
            <p className="text-xs text-muted-foreground">{t("backup.importDesc")}</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void doImport(f);
              }}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              className="w-full rounded-xl gap-2"
            >
              {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t("backup.importBtn")}
            </Button>
          </div>

          <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary-soft/30 p-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            <p>{t("backup.note")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl gap-1.5">
            <X className="h-4 w-4" />
            {t("cat.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}