"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

export type CharacterMentionItem = { id: string; label: string };

export type CharacterMentionListProps = SuggestionProps<
  CharacterMentionItem,
  CharacterMentionItem
>;

export type CharacterMentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

/** TipTap @-mention dropdown; keyboard nav via imperative handle. */
const CharacterMentionSuggestionInner = forwardRef<
  CharacterMentionListHandle,
  CharacterMentionListProps
>(function CharacterMentionSuggestion(props, ref) {
  const items = props.items;
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (keyProps: SuggestionKeyDownProps) => {
      if (keyProps.event.key === "ArrowUp") {
        setSelected((s) => (items.length ? (s + items.length - 1) % items.length : 0));
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
    <div className="rounded-lg border border-surface-border bg-[#1a1410] shadow-xl py-1 max-h-56 overflow-y-auto min-w-[220px] text-ink">
      {items.length === 0 ? (
        <div className="px-3 py-2 text-sm text-ink-muted">No characters match</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              i === selected
                ? "bg-brand-muted text-ink"
                : "text-ink-muted hover:bg-surface-card hover:text-ink"
            }`}
            onMouseEnter={() => setSelected(i)}
            onClick={() => props.command(item)}
          >
            <span className="font-medium text-ink">{item.label}</span>
            <span className="text-ink-faint text-xs ml-1">({item.id})</span>
          </button>
        ))
      )}
    </div>
  );
});

CharacterMentionSuggestionInner.displayName = "CharacterMentionSuggestion";

export default CharacterMentionSuggestionInner;
