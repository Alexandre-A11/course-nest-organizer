import jsPDF from "jspdf";
import TurndownService from "turndown";
import FileSaver from "file-saver";

const { saveAs } = FileSaver;

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

function htmlToPlainText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Convert <br> and block elements to newlines
  tmp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  tmp.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote").forEach((el) => {
    el.append("\n");
  });
  return (tmp.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export type ExportFormat = "txt" | "md" | "html" | "pdf" | "doc";

export interface ExportOptions {
  filename: string; // base name without extension
  title?: string;
  html: string;
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "anotacoes";
}

export function exportNotes(format: ExportFormat, opts: ExportOptions) {
  const base = safeName(opts.filename);
  const html = opts.html || "";
  const title = opts.title ?? base;

  if (format === "txt") {
    const txt = htmlToPlainText(html);
    saveAs(new Blob([txt], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
    return;
  }

  if (format === "md") {
    const md = turndown.turndown(html);
    const body = title ? `# ${title}\n\n${md}` : md;
    saveAs(new Blob([body], { type: "text/markdown;charset=utf-8" }), `${base}.md`);
    return;
  }

  if (format === "html") {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a}h1,h2,h3{line-height:1.25}mark{background:#fff3a3;padding:0 .2em;border-radius:.2em}blockquote{border-left:3px solid #ddd;margin:1em 0;padding:.25em 1em;color:#555}code{background:#f3f3f3;padding:.1em .35em;border-radius:.3em;font-family:ui-monospace,Menlo,monospace}</style>
</head><body><h1>${escapeHtml(title)}</h1>${html}</body></html>`;
    saveAs(new Blob([doc], { type: "text/html;charset=utf-8" }), `${base}.html`);
    return;
  }

  if (format === "doc") {
    // Word opens HTML files saved with .doc extension and an MS Office hint header.
    const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;line-height:1.5}</style></head>
<body><h1>${escapeHtml(title)}</h1>${html}</body></html>`;
    saveAs(
      new Blob(["\ufeff", doc], { type: "application/msword;charset=utf-8" }),
      `${base}.doc`,
    );
    return;
  }

  if (format === "pdf") {
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const marginX = 48;
    const marginY = 56;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const usableW = pageW - marginX * 2;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(title, marginX, marginY);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);

    const text = htmlToPlainText(html);
    const lines = pdf.splitTextToSize(text || "(sem conteúdo)", usableW) as string[];

    let y = marginY + 24;
    const lineH = 16;
    for (const line of lines) {
      if (y + lineH > pageH - marginY) {
        pdf.addPage();
        y = marginY;
      }
      pdf.text(line, marginX, y);
      y += lineH;
    }

    pdf.save(`${base}.pdf`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}