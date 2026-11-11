"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Editor rich text ringkas (Tiptap). Keluaran HTML — SELALU disanitasi di server sebelum disimpan. */
export function RichTextEditor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (html: string) => void;
  label: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
        class:
          "prose-sm min-h-24 px-3 py-2 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });
  if (!editor) return <div className="border-input min-h-32 rounded-md border" />;
  const btn = (active: boolean, aria: string, run: () => void, Icon: typeof Bold) => (
    <Button
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      aria-label={aria}
      className="size-7"
      onClick={run}
    >
      <Icon className="size-3.5" />
    </Button>
  );
  return (
    <div className="border-input focus-within:ring-ring/50 rounded-md border focus-within:ring-[3px]">
      <div className="border-input flex gap-1 border-b p-1">
        {btn(
          editor.isActive("bold"),
          "Tebal",
          () => editor.chain().focus().toggleBold().run(),
          Bold,
        )}
        {btn(
          editor.isActive("italic"),
          "Miring",
          () => editor.chain().focus().toggleItalic().run(),
          Italic,
        )}
        {btn(
          editor.isActive("bulletList"),
          "Daftar",
          () => editor.chain().focus().toggleBulletList().run(),
          List,
        )}
        {btn(
          editor.isActive("orderedList"),
          "Daftar bernomor",
          () => editor.chain().focus().toggleOrderedList().run(),
          ListOrdered,
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
