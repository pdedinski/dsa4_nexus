"use client";

import { useEffect, useMemo, useState } from "react";
import weaponsData from "@/data/equipment/weapons.json";
import BodyPortal from "@/components/ui/BodyPortal";

type WeaponRow = (typeof weaponsData.weapons)[number];

function talentGroupKey(w: WeaponRow): string {
  const t = w.combat_talent;
  return t && String(t).trim() ? String(t).trim() : "_other";
}

function talentLabel(key: string) {
  if (key === "_other") return "Other";
  return key.replace(/_/g, " ");
}

function toggleId(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return [...ids, id];
}

export default function CharacterWizardStepWeapons({
  open,
  selectedIds,
  onSelectedIdsChange,
  onBack,
  onNext,
  onCancel,
}: {
  open: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, WeaponRow[]>();
    for (const w of weaponsData.weapons) {
      const k = talentGroupKey(w);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    }
    const keys = [...map.keys()].sort((a, b) =>
      talentLabel(a).localeCompare(talentLabel(b), undefined, {
        sensitivity: "base",
      })
    );
    return keys.map((talentKey) => {
      const rows = map.get(talentKey)!;
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      return { talentKey, rows };
    });
  }, []);

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(({ talentKey, rows }) => ({
        talentKey,
        rows: rows.filter(
          (w) =>
            w.name.toLowerCase().includes(q) ||
            (w.german_name && String(w.german_name).toLowerCase().includes(q)) ||
            w.id.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [groups, filter]);

  useEffect(() => {
    if (!open) return;
    setFilter("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const count = selectedIds.length;

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[280] flex flex-col bg-[#0a0705]">
        <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="weapon-select-title"
            className="flex max-h-[min(92vh,920px)] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-2xl"
          >
            <div className="shrink-0 border-b border-surface-border px-4 py-3 sm:px-5">
              <h2
                id="weapon-select-title"
                className="text-lg font-bold text-ink leading-snug"
              >
                Weapons
              </h2>
              <p className="text-xs text-ink-muted mt-1.5 leading-relaxed max-w-prose">
                Select any number of weapons (grouped by combat talent). Modifiers are
                from the codex; final AT/PA still follow your talent rows and armor per
                the rulebook.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-ink-muted tabular-nums">
                  {count} selected
                </span>
                {count > 0 && (
                  <button
                    type="button"
                    className="text-xs text-brand-muted hover:underline"
                    onClick={() => onSelectedIdsChange([])}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <label className="mt-3 block text-xs text-ink-muted">
                <span className="sr-only">Filter weapons</span>
                <input
                  type="search"
                  placeholder="Filter by name…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-border bg-[#2c251f] px-3 py-2 text-sm text-[#f2e8dc] placeholder:text-ink-faint"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 space-y-3 bg-surface-card overscroll-contain">
              {filteredGroups.map(({ talentKey, rows }) => (
                <details
                  key={talentKey}
                  open
                  className="rounded-lg border border-surface-border bg-surface-sidebar/20 overflow-hidden"
                >
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-ink bg-surface-sidebar/50 border-b border-surface-border">
                    <span className="capitalize">{talentLabel(talentKey)}</span>
                    <span className="text-ink-muted font-normal text-xs ml-2">
                      ({rows.length})
                    </span>
                  </summary>
                  <ul className="list-none p-0 m-0 divide-y divide-surface-border/60">
                    {rows.map((w) => {
                      const at = typeof w.at_modifier === "number" ? w.at_modifier : 0;
                      const pa = typeof w.pa_modifier === "number" ? w.pa_modifier : 0;
                      const ini =
                        typeof w.ini_modifier === "number" ? w.ini_modifier : 0;
                      const checked = selectedIds.includes(w.id);
                      return (
                        <li key={w.id}>
                          <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-sidebar/40">
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0 rounded border-surface-border"
                              checked={checked}
                              onChange={() =>
                                onSelectedIdsChange(toggleId(selectedIds, w.id))
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-ink leading-snug break-words">
                                {w.name}
                              </span>
                              <span className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs font-mono text-ink-muted tabular-nums">
                                <span>
                                  AT {at >= 0 ? "+" : ""}
                                  {at}
                                </span>
                                <span>
                                  PA {pa >= 0 ? "+" : ""}
                                  {pa}
                                </span>
                                <span>
                                  INI {ini >= 0 ? "+" : ""}
                                  {ini}
                                </span>
                                <span
                                  className="col-span-2 sm:col-span-1 truncate"
                                  title={w.damage}
                                >
                                  {w.damage}
                                </span>
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>

            <div className="shrink-0 border-t border-surface-border px-3 py-3 sm:px-4 flex flex-wrap justify-between gap-2 bg-surface-card">
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
                onClick={onCancel}
              >
                Cancel
              </button>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
                  onClick={onBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium"
                  onClick={onNext}
                >
                  Next: Armor
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
