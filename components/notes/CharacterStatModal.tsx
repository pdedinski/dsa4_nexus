"use client";

import { useEffect, useState } from "react";
import BodyPortal from "@/components/ui/BodyPortal";
import CharacterSheetView from "@/components/characters/CharacterSheet";
import type { CharacterSheet } from "@/lib/character/types";

/** Modal: load character by URL slug and show full sheet. */
export default function CharacterStatModal({
  characterId,
  onClose,
}: {
  characterId: string | null;
  onClose: () => void;
}) {
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!characterId) {
      setSheet(null);
      setName("");
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSheet(null);
    void (async () => {
      const res = await fetch(
        `/api/characters/${encodeURIComponent(characterId)}`
      );
      const data = await res.json();
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(data.error ?? "Failed to load character");
        return;
      }
      setSheet(data.sheet as CharacterSheet);
      setName(data.name as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [characterId]);

  if (!characterId) return null;

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[200] flex flex-col bg-black/70">
        <div className="mx-auto my-4 flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-[#1a1410] shadow-2xl md:my-8">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
            <h2 className="truncate font-bold text-ink">
              {loading ? "Loading…" : name || characterId}
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {error && (
              <p className="p-4 text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            {!loading && sheet && <CharacterSheetView sheet={sheet} />}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
