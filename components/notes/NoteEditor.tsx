"use client";

import { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Editor, JSONContent } from "@tiptap/core";
import "tippy.js/dist/tippy.css";
import {
  createCharacterMentionExtension,
  type CharacterMentionCtxRef,
} from "./createCharacterMentionExtension";
import {
  createNoteMentionExtension,
  type NoteMentionCtxRef,
} from "./createNoteMentionExtension";
import {
  createImageMentionExtension,
  type ImageMentionCtxRef,
} from "./createImageMentionExtension";

function MenuBar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 mb-3 border-b border-surface-border pb-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`px-2 py-1 rounded text-xs border border-surface-border ${
          editor.isActive("bold") ? "bg-brand-muted text-ink" : "text-ink-muted hover:bg-surface-card"
        }`}
      >
        Bold
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`px-2 py-1 rounded text-xs border border-surface-border ${
          editor.isActive("italic") ? "bg-brand-muted text-ink" : "text-ink-muted hover:bg-surface-card"
        }`}
      >
        Italic
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-2 py-1 rounded text-xs border border-surface-border ${
          editor.isActive("bulletList") ? "bg-brand-muted text-ink" : "text-ink-muted hover:bg-surface-card"
        }`}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-2 py-1 rounded text-xs border border-surface-border ${
          editor.isActive("orderedList") ? "bg-brand-muted text-ink" : "text-ink-muted hover:bg-surface-card"
        }`}
      >
        Ordered
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-2 py-1 rounded text-xs border border-surface-border ${
          editor.isActive("heading", { level: 2 }) ? "bg-brand-muted text-ink" : "text-ink-muted hover:bg-surface-card"
        }`}
      >
        H2
      </button>
    </div>
  );
}

export default function NoteEditor({
  contentJson,
  editable,
  onChange,
  ctxRef,
  noteMentionCtxRef,
  imageMentionCtxRef,
}: {
  contentJson: Record<string, unknown>;
  editable: boolean;
  onChange?: (json: Record<string, unknown>) => void;
  ctxRef: CharacterMentionCtxRef;
  noteMentionCtxRef: NoteMentionCtxRef;
  imageMentionCtxRef: ImageMentionCtxRef;
}) {
  const mentionExtension = useMemo(
    () => createCharacterMentionExtension(ctxRef),
    [ctxRef]
  );

  const noteMentionExtension = useMemo(
    () => createNoteMentionExtension(noteMentionCtxRef),
    [noteMentionCtxRef]
  );

  const imageMentionExtension = useMemo(
    () => createImageMentionExtension(imageMentionCtxRef),
    [imageMentionCtxRef]
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit,
        mentionExtension,
        noteMentionExtension,
        imageMentionExtension,
      ],
      content: contentJson as JSONContent,
      editable,
      editorProps: {
        attributes: {
          class:
            "tiptap ProseMirror prose-invert focus:outline-none min-h-[220px] text-ink text-sm leading-relaxed",
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getJSON() as Record<string, unknown>);
      },
    },
    [mentionExtension, noteMentionExtension, imageMentionExtension]
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div className="rounded-lg border border-surface-border bg-[#110e0a] p-4 text-sm text-ink-muted min-h-[240px]">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="note-editor rounded-lg border border-surface-border bg-[#110e0a] p-3 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_li]:my-0.5 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_p]:my-2">
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
