"use client";

import type { MutableRefObject } from "react";
import { Mention } from "@tiptap/extension-mention";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import ImageMentionNode from "./ImageMentionNode";
import ImageMentionSuggestion, {
  type ImageMentionItem,
  type ImageMentionListHandle,
} from "./ImageMentionSuggestion";

export type ImageRowBrief = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
};

export type ImageMentionCtx = {
  images: ImageRowBrief[];
  onImageClick?: (imageId: string, url: string, label: string) => void;
};

export type ImageMentionCtxRef = MutableRefObject<ImageMentionCtx>;

export function createImageMentionExtension(ctxRef: ImageMentionCtxRef) {
  return Mention.extend({
    name: "imageMention",

    addAttributes() {
      return {
        ...this.parent?.(),
        url: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-url"),
          renderHTML: (attributes) => {
            if (!attributes.url) return {};
            return { "data-url": attributes.url };
          },
        },
      };
    },

    addStorage() {
      return {
        ctxRef,
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(ImageMentionNode);
    },
  }).configure({
    renderHTML({ options, node }) {
      return [
        "span",
        mergeAttributes(
          { "data-type": "imageMention" },
          options.HTMLAttributes,
          {
            "data-id": node.attrs.id,
            "data-label": node.attrs.label,
            "data-url": node.attrs.url,
          }
        ),
        `^${node.attrs.label ?? node.attrs.id}`,
      ];
    },
    renderText({ node }) {
      return `^${node.attrs.label ?? node.attrs.id}`;
    },
    suggestions: [
      {
        char: "^",
        items: ({ query }): ImageMentionItem[] => {
          const { images } = ctxRef.current;
          const q = query.trim().toLowerCase();
          return images
            .filter(
              (img) =>
                !q ||
                img.name.toLowerCase().includes(q) ||
                img.id.toLowerCase().includes(q)
            )
            .slice(0, 25)
            .map((img) => ({
              id: img.id,
              label: img.name,
              url: img.url,
              thumbnailUrl: img.thumbnailUrl,
            }));
        },
        command: ({ editor, range, props }) => {
          const item = props as ImageMentionItem;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              {
                type: "imageMention",
                attrs: {
                  id: item.id,
                  label: item.label,
                  url: item.url,
                },
              },
            ])
            .run();
        },
        render: () => {
          let component: ReactRenderer<ImageMentionListHandle> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (suggProps) => {
              component = new ReactRenderer(ImageMentionSuggestion, {
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
