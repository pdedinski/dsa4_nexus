"use client";

import { useState } from "react";
import BodyPortal from "@/components/ui/BodyPortal";

export type NameConflictChoice =
  | { action: "overwrite" }
  | { action: "newVersion" }
  | { action: "newCharacter"; name: string };

export default function SaveNameConflictDialog({
  open,
  existingName,
  suggestedName,
  busy,
  error,
  onCancel,
  onChoose,
}: {
  open: boolean;
  existingName: string;
  suggestedName: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onChoose: (choice: NameConflictChoice) => void;
}) {
  const [mode, setMode] = useState<"choose" | "rename">("choose");
  const [newName, setNewName] = useState(suggestedName);

  if (!open) return null;

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-md rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl space-y-4">
          {mode === "choose" ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Character name already exists
                </h2>
                <p className="text-sm text-ink-muted mt-2">
                  A saved character named{" "}
                  <span className="text-ink font-medium">{existingName}</span>{" "}
                  already exists. How do you want to save?
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium disabled:opacity-50"
                  onClick={() => onChoose({ action: "overwrite" })}
                >
                  Overwrite latest version
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm border border-brand text-brand hover:bg-brand-muted font-medium disabled:opacity-50"
                  onClick={() => onChoose({ action: "newVersion" })}
                >
                  Save as new version
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar disabled:opacity-50"
                  onClick={() => {
                    setNewName(suggestedName);
                    setMode("rename");
                  }}
                >
                  Save as new character…
                </button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar disabled:opacity-50"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Save as new character
                </h2>
                <p className="text-sm text-ink-muted mt-2">
                  Choose a name that is not already used by a saved character.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Character name
                </span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border bg-[#2c251f] text-sm text-ink scheme-dark outline-none focus:border-brand"
                  autoFocus
                />
              </label>
              {error && (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar disabled:opacity-50"
                  onClick={() => {
                    setMode("choose");
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy || !newName.trim()}
                  className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium disabled:opacity-50"
                  onClick={() =>
                    onChoose({ action: "newCharacter", name: newName.trim() })
                  }
                >
                  Continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </BodyPortal>
  );
}
