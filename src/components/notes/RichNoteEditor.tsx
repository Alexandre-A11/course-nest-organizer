import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline as UIcon, Strikethrough, List, ListOrdered, Highlighter,
  Heading1, Heading2, Quote, Code as CodeIcon, RotateCcw, Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";

const TEXT_COLORS: { key: string; value: string | null }[] = [
  { key: "color.default", value: null },
  { key: "color.red",     value: "#ef4444" },
  { key: "color.orange",  value: "#f97316" },
  { key: "color.amber",   value: "#f59e0b" },
  { key: "color.green",   value: "#10b981" },
  { key: "color.cyan",    value: "#06b6d4" },
  { key: "color.blue",    value: "#3b82f6" },
  { key: "color.purple",  value: "#8b5cf6" },
  { key: "color.pink",    value: "#ec4899" },
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Optional callback to inject a timestamp link string (e.g. "[1:23] "). */
  onInsertTimestamp?: () => string | null;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function RichNoteEditor({ value, onChange, placeholder, onInsertTimestamp, className, onFocus, onBlur }: Props) {
  const { t } = useI18n();
  // Track the last value we emitted so external state updates (e.g. switching
  // file) reset the editor without clobbering local edits.
  const lastEmitted = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: placeholder ?? t("notes.placeholder") }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "rt-prose focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
    onFocus: () => { onFocus?.(); },
    onBlur: () => { onBlur?.(); },
  });

  // Sync external value changes (file switch) only when content really differs.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
    lastEmitted.current = value;
  }, [value, editor]);

  if (!editor) {
    return <div className="rt-editor min-h-[120px] rounded-xl border border-border bg-background" />;
  }

  const handleInsertTimestamp = () => {
    if (!onInsertTimestamp) return;
    const stamp = onInsertTimestamp();
    if (!stamp) return;
    editor.chain().focus().insertContent(stamp).run();
  };

  return (
    <div className={cn("rt-editor flex flex-col rounded-xl border border-border bg-background", className)}>
      <Toolbar editor={editor} onInsertTimestamp={onInsertTimestamp ? handleInsertTimestamp : undefined} />
      <EditorContent editor={editor} className="px-3 py-2.5 max-h-[40vh] overflow-auto" />
    </div>
  );
}

function Toolbar({ editor, onInsertTimestamp }: { editor: Editor; onInsertTimestamp?: () => void }) {
  const { t } = useI18n();
  const Btn = ({
    onClick, active, title, children,
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        active && "bg-primary-soft text-primary",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1">
      <Btn title={t("notes.bold")} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.italic")} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.underline")} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UIcon className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.strike")} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.highlight")} active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter className="h-3.5 w-3.5" />
      </Btn>

      <div className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            title={t("notes.color")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Type className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="rounded-xl">
          {TEXT_COLORS.map((c) => (
            <DropdownMenuItem
              key={c.key}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (c.value) editor.chain().focus().setColor(c.value).run();
                else editor.chain().focus().unsetColor().run();
              }}
              className="flex items-center gap-2"
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-border"
                style={{ background: c.value ?? "transparent" }}
              />
              <span className="text-sm">{t(c.key)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 h-4 w-px bg-border" />

      <Btn title={t("notes.h1")} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.h2")} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.list")} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.olist")} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.quote")} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-3.5 w-3.5" />
      </Btn>
      <Btn title={t("notes.code")} active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <CodeIcon className="h-3.5 w-3.5" />
      </Btn>

      <div className="mx-1 h-4 w-px bg-border" />

      <Btn title={t("notes.clear")} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <RotateCcw className="h-3.5 w-3.5" />
      </Btn>

      {onInsertTimestamp && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onInsertTimestamp}
          title={t("notes.insertTime")}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          ⏱ {t("notes.markTime")}
        </button>
      )}
    </div>
  );
}