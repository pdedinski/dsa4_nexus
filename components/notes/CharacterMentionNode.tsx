"use client";

import type { ReactNodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import type { CharacterMentionCtxRef } from "./createCharacterMentionExtension";

/** Inline mention node: link-like when read-only, chip when editing. */
export default function CharacterMentionNode(props: ReactNodeViewProps) {
  const { node, editor, extension } = props;
  const id = String(node.attrs.id ?? "");
  const label = String(node.attrs.label ?? id);

  const storage = extension.storage as { ctxRef?: CharacterMentionCtxRef };
  const onCharacterClick = storage.ctxRef?.current.onCharacterClick;

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper as="span" className="inline align-baseline">
        <button
          type="button"
          className="inline p-0 m-0 border-0 bg-transparent cursor-pointer text-sm font-medium text-brand-muted underline decoration-surface-border decoration-1 underline-offset-2 hover:decoration-brand hover:text-brand"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            if (id) onCharacterClick?.(id);
          }}
        >
          @{label}
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="span" className="inline align-baseline rounded px-0.5 text-sm bg-brand-muted/25 text-ink">
      <span className="text-brand-muted select-none">@</span>
      <span>{label}</span>
    </NodeViewWrapper>
  );
}
