"use client";

import type { ChargenFinishMode } from "@/lib/chargen/settings";

export default function ChargenSettingsDialog({
  open,
  finishMode,
  onFinishModeChange,
  onClose,
}: {
  open: boolean;
  finishMode: ChargenFinishMode;
  onFinishModeChange: (mode: ChargenFinishMode) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
        <h3 className="text-lg font-bold mb-3">Generator settings</h3>
        <fieldset className="space-y-2 text-sm">
          <legend className="text-ink-muted mb-2">Finish behavior</legend>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="finishMode"
              checked={finishMode === "strict"}
              onChange={() => onFinishModeChange("strict")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Strict</span>
              <span className="block text-xs text-ink-muted">
                Block Finish while any problem is an error.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="finishMode"
              checked={finishMode === "advisory"}
              onChange={() => onFinishModeChange("advisory")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Advisory (Java-style)</span>
              <span className="block text-xs text-ink-muted">
                Show problems but always allow Finish.
              </span>
            </span>
          </label>
        </fieldset>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded border border-surface-border px-3 py-1.5 text-sm hover:bg-surface-sidebar/60"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
