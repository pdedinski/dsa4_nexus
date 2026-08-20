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

type PackageRow = {
  id: string;
  name: string;
  sp: number;
  isHouse: boolean;
};

type WizardMode = "lead_spells" | "extra_activations";

export default function CharacterWizardStep2({
  open,
  raceId,
  cultureId,
  professionId,
  halfElfFullCaster,
  onBack,
  onContinue,
  onCancel,
}: {
  open: boolean;
  raceId: string;
  cultureId: string;
  professionId: string;
  halfElfFullCaster: boolean;
  onBack: () => void;
  onContinue: (
    priorities: Record<string, SpellPriority>,
    extras?: { leadSpellPicks?: string[] },
  ) => void;
  onCancel: () => void;
}) {
  const [spells, setSpells] = useState<SpellRow[]>([]);
  const [packageSpells, setPackageSpells] = useState<PackageRow[]>([]);
  const [mode, setMode] = useState<WizardMode>("extra_activations");
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [priorities, setPriorities] = useState<Record<string, SpellPriority>>(
    {},
  );
  const [leadPicks, setLeadPicks] = useState<string[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    setFilter("");
    setLeadPicks([]);
    setLoading(true);
    const q = new URLSearchParams({
      raceId,
      professionId,
      cultureId,
      halfElfFullCaster: halfElfFullCaster ? "true" : "false",
    });
    fetch(`/api/characters/spell-options?${q}`)
      .then((r) => r.json())
      .then((d) => {
        const list: SpellRow[] = d.spells ?? [];
        setSpells(list);
        setPackageSpells(d.packageSpells ?? []);
        setMode(d.mode === "lead_spells" ? "lead_spells" : "extra_activations");
        setLeadCount(typeof d.leadCount === "number" ? d.leadCount : 0);
        const init: Record<string, SpellPriority> = {};
        for (const s of list) init[s.id] = "none";
        setPriorities(init);
      })
      .finally(() => setLoading(false));
  }, [open, raceId, cultureId, professionId, halfElfFullCaster]);

  const filteredSpells = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return spells;
    return spells.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.traditions.some((t) => t.toLowerCase().includes(q)),
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

  function toggleLead(id: string) {
    setLeadPicks((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= leadCount) return prev;
      return [...prev, id];
    });
  }

  const leadOk = mode !== "lead_spells" || leadPicks.length === 0 || leadPicks.length === leadCount;

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
                {mode === "lead_spells"
                  ? `Choose ${leadCount} extra lead spells`
                  : "Extra spell activations"}
              </h2>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                {mode === "lead_spells" ? (
                  <>
                    Package spells below are already known (free starting SP). Choose{" "}
                    <span className="font-medium text-ink">
                      {leadCount} extra lead spells
                    </span>{" "}
                    at SP 0, or leave none selected to let the generator pick at random.
                    Elven Worldview makes lead and house spells cheaper to raise; other
                    known spells cost one SKT column more.
                  </>
                ) : (
                  <>
                    Package spells below are already known. Mark Low / Medium / High on
                    remaining spells to prefer them for the{" "}
                    <span className="font-medium text-ink">7 extra activations</span>{" "}
                    and leftover creation AP (magic spending is capped at about half the
                    AP pool). If every extra spell stays None, the generator uses the
                    remaining list with equal weight.
                  </>
                )}
              </p>
              {packageSpells.length > 0 && (
                <div className="mt-3 rounded-lg border border-surface-border bg-[#2c251f] p-2">
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted">
                    Already known from race / culture / profession
                  </div>
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {packageSpells.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-md bg-surface-sidebar px-2 py-0.5 text-xs text-ink"
                      >
                        {p.name} {p.sp}
                        {p.isHouse ? " · house" : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                  No extra spells match your search.
                </p>
              )}
              {!loading &&
                mode === "lead_spells" &&
                filteredSpells.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer gap-3 border border-surface-border rounded-lg p-2 text-sm bg-surface-sidebar/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={leadPicks.includes(s.id)}
                      onChange={() => toggleLead(s.id)}
                    />
                    <div>
                      <div className="font-medium text-ink">{s.name}</div>
                      {s.description && (
                        <p className="text-xs text-ink-muted line-clamp-2 mt-0.5 whitespace-pre-wrap">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
              {!loading &&
                mode === "extra_activations" &&
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
                  disabled={loading || !leadOk}
                  className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium disabled:opacity-50"
                  onClick={() =>
                    onContinue(
                      priorities,
                      mode === "lead_spells" && leadPicks.length === leadCount
                        ? { leadSpellPicks: leadPicks }
                        : undefined,
                    )
                  }
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
