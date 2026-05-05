"use client";

import type { MutableRefObject } from "react";
import { Mention } from "@tiptap/extension-mention";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import CharacterMentionNode from "./CharacterMentionNode";
import CharacterMentionSuggestion, {
  type CharacterMentionItem,
  type CharacterMentionListHandle,
} from "./CharacterMentionSuggestion";

export type CharacterRowBrief = {
  id: string;
  characterId: string;
  name: string;
};

export type CharacterMentionCtx = {
  characters: CharacterRowBrief[];
  onCharacterClick?: (characterId: string) => void;
};

export type CharacterMentionCtxRef = MutableRefObject<CharacterMentionCtx>;

export function createCharacterMentionExtension(ctxRef: CharacterMentionCtxRef) {
  return Mention.extend({
    addStorage() {
      return {
        ctxRef,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(CharacterMentionNode);
    },
  }).configure({
    renderHTML({ options, node }) {
      return [
        "span",
        mergeAttributes(
          { "data-type": "mention" },
          options.HTMLAttributes,
          {
            "data-id": node.attrs.id,
            "data-label": node.attrs.label,
          }
        ),
        `@${node.attrs.label ?? node.attrs.id}`,
      ];
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestions: [
      {
        char: "@",
        items: ({ query }): CharacterMentionItem[] => {
          const { characters } = ctxRef.current;
          const q = query.trim().toLowerCase();
          return characters
            .filter(
              (c) =>
                !q ||
                c.name.toLowerCase().includes(q) ||
                c.characterId.toLowerCase().includes(q)
            )
            .slice(0, 25)
            .map((c) => ({ id: c.characterId, label: c.name }));
        },
        render: () => {
          let component: ReactRenderer<CharacterMentionListHandle> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (suggProps) => {
              component = new ReactRenderer(CharacterMentionSuggestion, {
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
