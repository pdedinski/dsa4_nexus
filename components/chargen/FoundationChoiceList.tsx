"use client";

/**
 * Java-style race/culture/profession list: show all options, mark rule-incompatible
 * entries in red (still selectable — soft override, flagged on Problems).
 */
export default function FoundationChoiceList({
  items,
  value,
  disabled,
  isAllowed,
  unavailableTitle,
  onChange,
}: {
  items: { id: string; label: string; custom?: boolean }[];
  value: string;
  disabled?: boolean;
  isAllowed: (id: string) => boolean;
  unavailableTitle: string;
  onChange: (id: string) => void;
}) {
  return (
    <ul className="mt-1 max-h-80 overflow-y-auto rounded border border-surface-border bg-[#2c251f]">
      {items.map((item) => {
        const allowed = isAllowed(item.id);
        const selected = value === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={disabled}
              title={allowed ? undefined : unavailableTitle}
              className={`w-full px-2 py-1.5 text-left text-sm disabled:opacity-60 disabled:pointer-events-none ${
                selected
                  ? "bg-brand text-white"
                  : allowed
                    ? "text-[#f2e8dc] hover:bg-surface-sidebar/80"
                    : "text-red-500 hover:bg-surface-sidebar/50"
              }`}
              onClick={() => onChange(item.id)}
            >
              {item.label}
              {item.custom ? " (Custom)" : ""}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
