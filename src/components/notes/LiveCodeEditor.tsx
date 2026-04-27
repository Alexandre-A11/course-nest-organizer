import { useMemo } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-docker";
import { cn } from "@/lib/utils";

/** Map our snapshot language ids → the Prism grammar id (keys are Prism's). */
const PRISM_ALIAS: Record<string, string> = {
  typescript: "typescript",
  ts:         "typescript",
  tsx:        "tsx",
  jsx:        "jsx",
  javascript: "javascript",
  js:         "javascript",
  html:       "markup",
  xml:        "markup",
  css:        "css",
  json:       "json",
  python:     "python",
  py:         "python",
  java:       "java",
  rust:       "rust",
  rs:         "rust",
  bash:       "bash",
  sh:         "bash",
  shell:      "bash",
  yaml:       "yaml",
  yml:        "yaml",
  sql:        "sql",
  dockerfile: "docker",
  docker:     "docker",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlight(code: string, language: string): string {
  const id = PRISM_ALIAS[language?.toLowerCase()] ?? "markup";
  const grammar = Prism.languages[id] ?? Prism.languages.markup;
  try {
    return Prism.highlight(code, grammar, id);
  } catch {
    return escapeHtml(code);
  }
}

interface Props {
  value: string;
  language: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
}

/**
 * Live-highlighted code editor used inside the Snapshots panel and the
 * /notes dashboard. Pairs `react-simple-code-editor` with PrismJS so the
 * tokens recolour as the user types — no save/round-trip required.
 */
export function LiveCodeEditor({
  value, language, onChange, placeholder, className, minHeight = 140, maxHeight = 360, readOnly,
}: Props) {
  // memoised highlighter so React only recalculates when value/lang change.
  const highlightFn = useMemo(
    () => (code: string) => highlight(code, language),
    [language],
  );
  return (
    <div
      className={cn(
        "live-code-editor cv-prism overflow-auto rounded-lg border border-border bg-muted/30 font-mono text-xs leading-relaxed",
        className,
      )}
      style={{ minHeight, maxHeight }}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlightFn}
        padding={12}
        textareaClassName="focus:outline-none"
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
          fontSize: 12,
          lineHeight: 1.55,
          minHeight,
        }}
      />
    </div>
  );
}