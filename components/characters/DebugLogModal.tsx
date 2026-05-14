"use client";

import { X } from "lucide-react";
import clsx from "clsx";

function stageTone(line: string): string {
  const m = line.match(/^\[([^\]]+)/);
  const tag = m?.[1] ?? "";

  if (tag.startsWith("GP")) return "text-amber-700 dark:text-amber-400";
  if (
    tag.startsWith("Spells") ||
    tag.startsWith("Creation") ||
    tag.startsWith("Start") ||
    tag.startsWith("Identity") ||
    tag.startsWith("Attributes")
  )
    return "text-sky-700 dark:text-sky-400";
  if (tag.startsWith("VeteranAP") || tag.startsWith("AP_Profile") || tag.startsWith("ResidualAP"))
    return "text-violet-700 dark:text-violet-400";
  if (tag.startsWith("SA") || tag.startsWith("ShieldArmor")) return "text-emerald-700 dark:text-emerald-400";
  if (tag.startsWith("Done")) return "text-ink font-medium";
  return "text-ink-muted";
}

export default function DebugLogModal({
  lines,
  onClose,
}: {
  lines: string[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[min(90vh,42rem)] w-full max-w-3xl flex-col rounded-xl border border-surface-border bg-[#1f1914] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Generation debug log"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold text-ink">Generation debug trace</h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-sidebar hover:text-ink"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <pre
          className="m-0 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words"
          dir="ltr"
        >
          {lines.length === 0 ? (
            <span className="text-ink-muted">(Empty log)</span>
          ) : (
            lines.map((line, i) => (
              <div key={`${i}-${line.slice(0, 48)}`} className={clsx("py-0.5 border-b border-surface-border/30 last:border-0", stageTone(line))}>
                {line}
              </div>
            ))
          )}
        </pre>
      </div>
    </div>
  );
}
