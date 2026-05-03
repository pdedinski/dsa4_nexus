"use client";

import { useEffect, useMemo, useState } from "react";
import type { SpellPriority } from "@/lib/character/types";
import BodyPortal from "@/components/ui/BodyPortal";

type SpellRow = {
  id: string;
  name: string;
  description: string;
  traditions: string[];
};

export default function CharacterWizardStep2({
  open,
  raceId,
  professionId,
  halfElfFullCaster,
  onBack,
  onContinue,
  onCancel,
}: {
  open: boolean;
  raceId: string;
  professionId: string;
  halfElfFullCaster: boolean;
  onBack: () => void;
  onContinue: (priorities: Record<string, SpellPriority>) => void;
  onCancel: () => void;
}) {
  const [spells, setSpells] = useState<SpellRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [priorities, setPriorities] = useState<Record<string, SpellPriority>>(
    {}
  );
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilter("");
    setLoading(true);
    const q = new URLSearchParams({
      raceId,
      professionId,
      halfElfFullCaster: halfElfFullCaster ? "true" : "false",
    });
    fetch(`/api/characters/spell-options?${q}`)
      .then((r) => r.json())
      .then((d) => {
        const list: SpellRow[] = d.spells ?? [];
        setSpells(list);
        const init: Record<string, SpellPriority> = {};
        for (const s of list) init[s.id] = "none";
        setPriorities(init);
      })
      .finally(() => setLoading(false));
  }, [open, raceId, professionId, halfElfFullCaster]);

  const filteredSpells = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return spells;
    return spells.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.traditions.some((t) => t.toLowerCase().includes(q))
    );
  }, [spells, filter]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[300] flex flex-col bg-[#0a0705]">
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="spell-select-title"
            className="flex max-h-[min(90vh,900px)] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-2xl"
          >
            <div className="shrink-0 border-b border-surface-border bg-surface-card p-4">
              <h2
                id="spell-select-title"
                className="text-lg font-bold text-ink"
              >
                Select spells
              </h2>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                Default is <span className="font-medium text-ink">None</span> — the
                random generator will only spend SGP on spells you mark Low, Medium, or
                High (a smaller pool). If every spell stays None, the generator falls
                back to the full list with equal weight.
              </p>
              <label className="mt-3 block text-xs text-ink-muted">
                <span className="sr-only">Search spells</span>
                <input
                  type="search"
                  placeholder="Search by name, tradition, or text…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-border bg-[#2c251f] px-3 py-2 text-sm text-[#f2e8dc] placeholder:text-ink-faint"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 bg-surface-card">
              {loading && (
                <p className="text-sm text-ink-muted p-4">Loading spell list…</p>
              )}
              {!loading && filteredSpells.length === 0 && (
                <p className="text-sm text-ink-muted p-4">
                  No spells match your search.
                </p>
              )}
              {!loading &&
                filteredSpells.map((s) => (
                  <div
                    key={s.id}
                    className="border border-surface-border rounded-lg p-2 text-sm bg-surface-sidebar/40"
                  >
                    <div className="font-medium text-ink">{s.name}</div>
                    {s.description && (
                      <p className="text-xs text-ink-muted line-clamp-2 mt-0.5 whitespace-pre-wrap">
                        {s.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-xs">
                      {(["none", "low", "medium", "high"] as const).map((p) => (
                        <label
                          key={p}
                          className="flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          <input
                            type="radio"
                            name={`sp-${s.id}`}
                            checked={priorities[s.id] === p}
                            onChange={() =>
                              setPriorities((prev) => ({
                                ...prev,
                                [s.id]: p,
                              }))
                            }
                          />
                          <span>
                            {p === "none"
                              ? "None"
                              : p.charAt(0).toUpperCase() + p.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <div className="shrink-0 border-t border-surface-border bg-surface-card p-3 flex justify-between gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
                onClick={onCancel}
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
                  onClick={onBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium disabled:opacity-50"
                  onClick={() => onContinue(priorities)}
                >
                  Next: Weapons
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
