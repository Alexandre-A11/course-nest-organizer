import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Props {
  page: number;          // 1-based
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

/**
 * Lightweight numeric pagination with Prev/Next + a window of page buttons.
 * Renders nothing when there's only one page.
 */
export function Pager({ page, totalPages, onChange, className }: Props) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;

  // Build a compact window of page numbers around the current page.
  const window: (number | "…")[] = [];
  const push = (v: number | "…") => {
    if (window[window.length - 1] !== v) window.push(v);
  };
  const lo = Math.max(2, page - 1);
  const hi = Math.min(totalPages - 1, page + 1);
  push(1);
  if (lo > 2) push("…");
  for (let i = lo; i <= hi; i++) push(i);
  if (hi < totalPages - 1) push("…");
  if (totalPages > 1) push(totalPages);

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className={`mt-6 flex flex-wrap items-center justify-center gap-1.5 ${className ?? ""}`}
    >
      <Button
        variant="outline" size="sm"
        className="h-8 gap-1 rounded-lg px-2 text-xs"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("pager.prev")}</span>
      </Button>
      {window.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
        ) : (
          <Button
            key={it}
            size="sm"
            variant={it === page ? "default" : "outline"}
            className="h-8 min-w-8 rounded-lg px-2 text-xs"
            onClick={() => onChange(it)}
          >
            {it}
          </Button>
        )
      )}
      <Button
        variant="outline" size="sm"
        className="h-8 gap-1 rounded-lg px-2 text-xs"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        <span className="hidden sm:inline">{t("pager.next")}</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </nav>
  );
}