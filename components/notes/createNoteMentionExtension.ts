"use client";

import type { MutableRefObject } from "react";
import { Mention } from "@tiptap/extension-mention";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import NoteMentionNode from "./NoteMentionNode";
import NoteMentionSuggestion, {
  type NoteMentionItem,
  type NoteMentionListHandle,
} from "./NoteMentionSuggestion";

export type NoteRowBrief = {
  id: string;
  title: string;
};

export type NoteMentionCtx = {
  notes: NoteRowBrief[];
  /** Excluded from suggestions (e.g. the note currently being edited). */
  excludeNoteId?: string;
  onNoteClick?: (noteId: string) => void;
};

export type NoteMentionCtxRef = MutableRefObject<NoteMentionCtx>;

export function createNoteMentionExtension(ctxRef: NoteMentionCtxRef) {
  return Mention.extend({
    name: "noteMention",

    addStorage() {
      return {
        ctxRef,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(NoteMentionNode);
    },
  }).configure({
    renderHTML({ options, node }) {
      return [
        "span",
        mergeAttributes(
          { "data-type": "noteMention" },
          options.HTMLAttributes,
          {
            "data-id": node.attrs.id,
            "data-label": node.attrs.label,
          }
        ),
        `#${node.attrs.label ?? node.attrs.id}`,
      ];
    },
    renderText({ node }) {
      return `#${node.attrs.label ?? node.attrs.id}`;
    },
    suggestions: [
      {
        char: "#",
        items: ({ query }): NoteMentionItem[] => {
          const { notes, excludeNoteId } = ctxRef.current;
          const q = query.trim().toLowerCase();
          return notes
            .filter((n) => n.id !== excludeNoteId)
            .filter(
              (n) =>
                !q ||
                (n.title ?? "").toLowerCase().includes(q) ||
                n.id.toLowerCase().includes(q)
            )
            .slice(0, 25)
            .map((n) => ({
              id: n.id,
              label: (n.title ?? "").trim() || "Untitled",
            }));
        },
        render: () => {
          let component: ReactRenderer<NoteMentionListHandle> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (suggProps) => {
              component = new ReactRenderer(NoteMentionSuggestion, {
                props: suggProps,
                editor: suggProps.editor,
              });

              if (!suggProps.clientRect) return;

              popup = tippy(document.body, {
                getReferenceClientRect: () =>
                  suggProps.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
              });
            },

            onUpdate(suggProps) {
              component?.updateProps(suggProps);
              popup?.setProps({
                getReferenceClientRect: () =>
                  suggProps.clientRect?.() ?? new DOMRect(0, 0, 0, 0),
              });
            },

            onKeyDown(suggProps) {
              if (suggProps.event.key === "Escape") {
                popup?.hide();
                return true;
              }
              const handled = component?.ref?.onKeyDown?.(suggProps);
              return Boolean(handled);
            },

            onExit() {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      },
    ],
  });
}
