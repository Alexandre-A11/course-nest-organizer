/**
 * Centralised highlight.js bootstrap. We register only the languages the
 * Course Vault project officially supports so the bundle stays small.
 *
 * Supported: js, ts, tsx/jsx, html, css, json, python, java, rust, dockerfile,
 * bash, yaml, sql.
 */
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml"; // HTML / JSX markup
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import rust from "highlight.js/lib/languages/rust";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import sqlLang from "highlight.js/lib/languages/sql";

let registered = false;
function ensure() {
  if (registered) return;
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("js", javascript);
  hljs.registerLanguage("jsx", javascript);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("ts", typescript);
  // TSX is treated as TypeScript by highlight.js; JSX subset comes via xml fallback.
  hljs.registerLanguage("tsx", typescript);
  hljs.registerLanguage("html", xml);
  hljs.registerLanguage("xml", xml);
  hljs.registerLanguage("css", css);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("python", python);
  hljs.registerLanguage("py", python);
  hljs.registerLanguage("java", java);
  hljs.registerLanguage("rust", rust);
  hljs.registerLanguage("rs", rust);
  hljs.registerLanguage("dockerfile", dockerfile);
  hljs.registerLanguage("docker", dockerfile);
  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("sh", bash);
  hljs.registerLanguage("shell", bash);
  hljs.registerLanguage("yaml", yaml);
  hljs.registerLanguage("yml", yaml);
  hljs.registerLanguage("sql", sqlLang);
  registered = true;
}

export interface LangOption {
  value: string;
  label: string;
}

/** Languages exposed in the picker. Order = popularity / project relevance. */
export const SUPPORTED_LANGUAGES: LangOption[] = [
  { value: "tsx",        label: "TypeScript JSX (React)" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript / Node.js / Next.js" },
  { value: "jsx",        label: "JavaScript JSX" },
  { value: "html",       label: "HTML" },
  { value: "css",        label: "CSS" },
  { value: "json",       label: "JSON" },
  { value: "python",     label: "Python" },
  { value: "java",       label: "Java" },
  { value: "rust",       label: "Rust" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "bash",       label: "Bash / Shell" },
  { value: "yaml",       label: "YAML" },
  { value: "sql",        label: "SQL" },
];

export function highlightCode(code: string, language: string): string {
  ensure();
  const lang = (language || "").toLowerCase();
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    // Escape on failure so we never inject raw HTML.
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

/** Convenience: pretty label from a stored language id. */
export function languageLabel(value: string): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.value === value);
  return found?.label ?? value;
}