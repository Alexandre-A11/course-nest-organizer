import { useState, type KeyboardEvent } from "react";
import { X, Tag as TagIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

function normalize(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
}

export function TagEditor({ value, onChange, className }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const add = () => {
    const tag = normalize(draft);
    if (!tag) return;
    if (value.includes(tag)) { setDraft(""); return; }
    onChange([...value, tag]);
    setDraft("");
  };

  const remove = (tag: string) => onChange(value.filter((x) => x !== tag));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && value.length) {
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <TagIcon className="h-3 w-3" /> {t("tags.label")}
      </span>
      {value.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground"
        >
          {tag}
          <button
            type="button"
            onClick={() => remove(tag)}
            title={t("tags.remove")}
            className="rounded text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={t("tags.placeholder")}
        className="min-w-[140px] flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:border-border focus:outline-none"
      />
    </div>
  );
}