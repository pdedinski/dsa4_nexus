"use client";

import { useEffect, useState } from "react";
import type { CharacterSheet } from "@/lib/character/types";
import BodyPortal from "@/components/ui/BodyPortal";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default function SaveCharacterDialog({
  open,
  sheet,
  onClose,
  onSaved,
}: {
  open: boolean;
  sheet: CharacterSheet | null;
  onClose: () => void;
  onSaved: (characterId: string) => void;
}) {
  const [characterId, setCharacterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && sheet) {
      setCharacterId(slugify(sheet.header.displayName) || "hero");
      setError(null);
    }
  }, [open, sheet]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !sheet) return null;

  async function save() {
    if (!sheet) return;
    setError(null);
    setSaving(true);
    try {
      const { debugLog: _omitDebug, ...persistableSheet } = sheet;
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: characterId.trim().toLowerCase(),
          name: sheet.header.displayName,
          sheet: persistableSheet,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        setSaving(false);
        return;
      }
      onSaved(data.characterId ?? characterId.trim().toLowerCase());
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[320] flex flex-col bg-[#0a0705]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-character-title"
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close"
          onClick={onClose}
        />
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-surface-card p-5 shadow-2xl">
            <h2
              id="save-character-title"
              className="text-lg font-bold text-ink mb-2"
            >
              Save character
            </h2>
            <p className="text-xs text-ink-muted mb-3">
              Choose a unique ID (slug) for this character in your library.
            </p>
            <label className="block text-sm">
              <span className="text-ink-muted">Character ID</span>
              <input
                className="mt-1 w-full rounded border border-surface-border bg-surface-sidebar px-2 py-2 font-mono text-sm text-ink"
                value={characterId}
                onChange={(e) =>
                  setCharacterId(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                  )
                }
              />
            </label>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !characterId}
                className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium disabled:opacity-50"
                onClick={save}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
