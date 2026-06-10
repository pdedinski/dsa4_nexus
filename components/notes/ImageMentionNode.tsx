"use client";

import type { ReactNodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import type { ImageMentionCtxRef } from "./createImageMentionExtension";

/** Inline image link: button in read-only; chip when editing. */
export default function ImageMentionNode(props: ReactNodeViewProps) {
  const { node, editor, extension } = props;
  const id = String(node.attrs.id ?? "");
  const label = String(node.attrs.label ?? id);
  const url = String(node.attrs.url ?? "");

  const storage = extension.storage as { ctxRef?: ImageMentionCtxRef };
  const onImageClick = storage.ctxRef?.current.onImageClick;

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper as="span" className="inline align-baseline">
        <button
          type="button"
          className="inline p-0 m-0 border-0 bg-transparent cursor-pointer text-sm font-medium text-brand-muted underline decoration-surface-border decoration-1 underline-offset-2 hover:decoration-brand hover:text-brand"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            if (id) onImageClick?.(id, url, label);
          }}
        >
          ^{label}
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="inline align-baseline rounded px-0.5 text-sm bg-brand-muted/20 text-ink"
    >
      <span className="text-brand-muted select-none">^</span>
      <span>{label}</span>
    </NodeViewWrapper>
  );
}
