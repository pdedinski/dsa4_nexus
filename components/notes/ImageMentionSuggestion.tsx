"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

export type ImageMentionItem = { id: string; label: string; url: string };

export type ImageMentionListProps = SuggestionProps<
  ImageMentionItem,
  ImageMentionItem
>;

export type ImageMentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

/** TipTap ^-mention dropdown with thumbnails; keyboard nav via imperative handle. */
const ImageMentionSuggestionInner = forwardRef<
  ImageMentionListHandle,
  ImageMentionListProps
>(function ImageMentionSuggestion(props, ref) {
  const items = props.items;
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (keyProps: SuggestionKeyDownProps) => {
      if (keyProps.event.key === "ArrowUp") {
        setSelected((s) =>
          items.length ? (s + items.length - 1) % items.length : 0
        );
        return true;
      }
      if (keyProps.event.key === "ArrowDown") {
        setSelected((s) => (items.length ? (s + 1) % items.length : 0));
        return true;
      }
      if (keyProps.event.key === "Enter") {
        if (items[selected]) props.command(items[selected]!);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="rounded-lg border border-surface-border bg-[#1a1410] shadow-xl py-1 max-h-56 overflow-y-auto min-w-[240px] text-ink">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-ink-muted">No images match</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
              i === selected
                ? "bg-brand-muted text-ink"
                : "text-ink-muted hover:bg-surface-card hover:text-ink"
            }`}
            onMouseEnter={() => setSelected(i)}
            onClick={() => props.command(item)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt=""
              className="h-8 w-8 shrink-0 rounded object-cover border border-surface-border"
            />
            <span className="font-medium text-ink truncate">{item.label}</span>
          </button>
        ))
      )}
    </div>
  );
});

ImageMentionSuggestionInner.displayName = "ImageMentionSuggestion";

export default ImageMentionSuggestionInner;
