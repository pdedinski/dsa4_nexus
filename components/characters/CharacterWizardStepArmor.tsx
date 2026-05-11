"use client";

import { useEffect, useMemo, useState } from "react";
import armorData from "@/data/equipment/armor.json";
import BodyPortal from "@/components/ui/BodyPortal";

type ArmorRow = (typeof armorData.armor)[number];

const CATEGORY_ORDER = [
  "cloth",
  "leather",
  "chain_scale",
  "plate",
  "exotic",
  "full_set",
  "helmet",
  "additional",
  "light",
  "medium",
  "heavy",
  "shield",
] as const;

function categoryLabel(cat: string) {
  if (cat === "cloth") return "Cloth armor";
  if (cat === "leather") return "Leather armor";
  if (cat === "chain_scale") return "Chain & scale";
  if (cat === "plate") return "Plate armor";
  if (cat === "exotic") return "Exotic armor";
  if (cat === "full_set") return "Full armor sets";
  if (cat === "helmet") return "Helmets";
  if (cat === "additional") return "Additional armor";
  if (cat === "light") return "Light armor";
  if (cat === "medium") return "Medium armor";
  if (cat === "heavy") return "Heavy armor";
  if (cat === "shield") return "Shields";
  return cat.replace(/_/g, " ");
}

function toggleId(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  return [...ids, id];
}

export default function CharacterWizardStepArmor({
  open,
  selectedIds,
  onSelectedIdsChange,
  buyArmorUseSa,
  onBuyArmorUseSaChange,
  onBack,
  onGenerate,
  onCancel,
}: {
  open: boolean;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  buyArmorUseSa: boolean;
  onBuyArmorUseSaChange: (value: boolean) => void;
  onBack: () => void;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, ArmorRow[]>();
    for (const a of armorData.armor) {
      const c = typeof a.category === "string" ? a.category : "other";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(a);
    }
    const keys = [...map.keys()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
      const ib = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
      if (ia !== -1 || ib !== -1) {
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      }
      return a.localeCompare(b);
    });
    return keys.map((category) => {
      const rows = map.get(category)!;
      rows.sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: "base" }));
      return { category, rows };
    });
  }, []);

  const hasShieldSelection = useMemo(
    () =>
      selectedIds.some((id) => {
        const row = armorData.armor.find((a) => a.id === id);
        return row?.category === "shield";
      }),
    [selectedIds],
  );

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(({ category, rows }) => ({
        category,
        rows: rows.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.german_name && String(a.german_name).toLowerCase().includes(q)) ||
            a.id.toLowerCase().includes(q)
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
      <div className="fixed inset-0 z-[290] flex flex-col bg-[#0a0705]">
        <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="armor-select-title"
            className="flex max-h-[min(92vh,920px)] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-2xl"
          >
            <div className="shrink-0 border-b border-surface-border px-4 py-3 sm:px-5">
              <h2
                id="armor-select-title"
                className="text-lg font-bold text-ink leading-snug"
              >
                Armor
              </h2>
              <p className="text-xs text-ink-muted mt-1.5 leading-relaxed max-w-prose">
                Select any combination of armor pieces and shields. RS (AR) and EC (BE)
                are per item in the codex; how they combine at the table follows the
                rulebook.
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-ink leading-snug">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0 rounded border-surface-border"
                  checked={buyArmorUseSa}
                  onChange={(e) => onBuyArmorUseSaChange(e.target.checked)}
                />
                <span>
                  Get Armor Use talent (Rüstungsgewöhnung) — attempts to buy the SA for
                  your highest-RS body armor (non-shield) using leftover veteran AP after
                  talents; BRW requirements apply.
                </span>
              </label>
              {hasShieldSelection ? (
                <p className="mt-2 text-xs text-ink-muted leading-relaxed max-w-prose">
                  A shield is selected: generation will try to buy Off-hand Fighting and
                  Shield Fighting from leftover veteran AP when BRW requirements are met.
                </p>
              ) : (
                <p className="mt-2 text-xs text-ink-muted leading-relaxed max-w-prose">
                  Shields chosen in the weapons step also trigger the same Shield Fighting
                  purchase attempt (not only armor listed here).
                </p>
              )}
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
                <span className="sr-only">Filter armor</span>
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
              {filteredGroups.map(({ category, rows }) => (
                <details
                  key={category}
                  open
                  className="rounded-lg border border-surface-border bg-surface-sidebar/20 overflow-hidden"
                >
                  <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-ink bg-surface-sidebar/50 border-b border-surface-border">
                    {categoryLabel(category)}
                    <span className="text-ink-muted font-normal text-xs ml-2">
                      ({rows.length})
                    </span>
                  </summary>
                  <ul className="list-none p-0 m-0 divide-y divide-surface-border/60">
                    {rows.map((a) => {
                      const ar = typeof a.ar === "number" ? a.ar : 0;
                      const ec = typeof a.ec === "number" ? a.ec : 0;
                      const ini =
                        typeof a.ini_modifier === "number" ? a.ini_modifier : 0;
                      const checked = selectedIds.includes(a.id);
                      return (
                        <li key={a.id}>
                          <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-sidebar/40">
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0 rounded border-surface-border"
                              checked={checked}
                              onChange={() =>
                                onSelectedIdsChange(toggleId(selectedIds, a.id))
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-ink leading-snug break-words">
                                {a.name}
                              </span>
                              <span className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs font-mono text-ink-muted tabular-nums">
                                <span>RS {ar}</span>
                                <span>EC {ec}</span>
                                <span>
                                  INI {ini >= 0 ? "+" : ""}
                                  {ini}
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
                  onClick={onGenerate}
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
