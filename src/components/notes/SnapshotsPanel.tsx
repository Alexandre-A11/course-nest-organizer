import { useEffect, useMemo, useState } from "react";
import {
  type CodeSnapshot,
  createSnapshot, deleteSnapshot, listSnapshotsForFile, updateSnapshot,
} from "@/lib/db";
import { SUPPORTED_LANGUAGES, highlightCode, languageLabel } from "@/lib/highlight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X, Copy, Code2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Props {
  fileId: string;
  courseId: string;
}

export function SnapshotsPanel({ fileId, courseId }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<CodeSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer state
  const [openComposer, setOpenComposer] = useState(false);
  const [draftLang, setDraftLang] = useState<string>("tsx");
  const [draftCode, setDraftCode] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLang, setEditLang] = useState("tsx");
  const [editCode, setEditCode] = useState("");
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listSnapshotsForFile(fileId).then((rows) => {
      if (!active) return;
      setItems(rows);
      setLoading(false);
    });
    return () => { active = false; };
  }, [fileId]);

  const resetComposer = () => {
    setOpenComposer(false);
    setDraftCode("");
    setDraftTitle("");
  };

  const handleCreate = async () => {
    if (!draftCode.trim()) {
      toast.error(t("snap.emptyCode"));
      return;
    }
    const snap = await createSnapshot({
      fileId, courseId, language: draftLang,
      code: draftCode, title: draftTitle,
    });
    setItems((prev) => [snap, ...prev]);
    resetComposer();
    toast.success(t("snap.created"));
  };

  const startEdit = (s: CodeSnapshot) => {
    setEditingId(s.id);
    setEditLang(s.language);
    setEditCode(s.code);
    setEditTitle(s.title ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const next = await updateSnapshot(editingId, {
      language: editLang, code: editCode, title: editTitle,
    });
    if (next) {
      setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)));
      toast.success(t("snap.updated"));
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteSnapshot(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast.success(t("snap.removed"));
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("snap.copied"));
    } catch {
      toast.error(t("toast.copyErr"));
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Code2 className="h-3.5 w-3.5" />
          <span>{t("snap.count", { n: items.length })}</span>
        </div>
        {!openComposer && (
          <Button size="sm" onClick={() => setOpenComposer(true)} className="h-7 gap-1 rounded-lg px-2 text-xs">
            <Plus className="h-3.5 w-3.5" />
            {t("snap.add")}
          </Button>
        )}
      </div>

      {openComposer && (
        <div className="space-y-2 border-b border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={t("snap.titlePh")}
              className="h-8 flex-1 rounded-lg text-sm"
            />
            <LanguagePicker value={draftLang} onChange={setDraftLang} />
          </div>
          <Textarea
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value)}
            placeholder={t("snap.codePh")}
            className="min-h-[140px] rounded-lg font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={resetComposer} className="h-7 rounded-lg text-xs">
              {t("btn.cancel")}
            </Button>
            <Button size="sm" onClick={handleCreate} className="h-7 gap-1 rounded-lg text-xs">
              <Check className="h-3.5 w-3.5" />
              {t("snap.save")}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">…</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
            <Code2 className="h-8 w-8 opacity-40" />
            <p className="mt-2 text-sm">{t("snap.empty")}</p>
            <p className="mt-1 text-xs opacity-70">{t("snap.emptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((s) => (
              <li key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {editingId === s.id ? (
                  <div className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t("snap.titlePh")}
                        className="h-8 flex-1 rounded-lg text-sm"
                      />
                      <LanguagePicker value={editLang} onChange={setEditLang} />
                    </div>
                    <Textarea
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="min-h-[140px] rounded-lg font-mono text-xs leading-relaxed"
                      spellCheck={false}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 gap-1 rounded-lg text-xs">
                        <X className="h-3.5 w-3.5" />
                        {t("btn.cancel")}
                      </Button>
                      <Button size="sm" onClick={saveEdit} className="h-7 gap-1 rounded-lg text-xs">
                        <Check className="h-3.5 w-3.5" />
                        {t("btn.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <SnapshotView
                    snapshot={s}
                    onEdit={() => startEdit(s)}
                    onDelete={() => handleDelete(s.id)}
                    onCopy={() => handleCopy(s.code)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LanguagePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[180px] rounded-lg text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[260px]">
        {SUPPORTED_LANGUAGES.map((l) => (
          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SnapshotView({
  snapshot, onEdit, onDelete, onCopy,
}: {
  snapshot: CodeSnapshot;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
}) {
  const { t } = useI18n();
  const html = useMemo(() => highlightCode(snapshot.code, snapshot.language), [snapshot.code, snapshot.language]);
  const when = useMemo(() => new Date(snapshot.createdAt).toLocaleString(), [snapshot.createdAt]);
  return (
    <div>
      <div className="flex items-start justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              {languageLabel(snapshot.language)}
            </span>
            {snapshot.title && (
              <span className="truncate text-sm font-medium text-foreground">{snapshot.title}</span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{when}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn onClick={onCopy} title={t("snap.copy")}><Copy className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={onEdit} title={t("snap.edit")}><Pencil className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={onDelete} title={t("snap.delete")} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
        </div>
      </div>
      <pre className="cv-code rounded-none border-0">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

function IconBtn({
  onClick, title, children, danger,
}: { onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        danger && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      {children}
    </button>
  );
}