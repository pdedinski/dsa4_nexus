"use client";

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel, LearningMethod } from "@/lib/chargen/types";
import { formatOwnedTraitName } from "@/lib/chargen/rules/traitLabels";
import {
  buyOffDisadvantage,
  disadvantageBuyOffCost,
  disadvantageReduceCost,
  reduceDisadvantageLevel,
} from "@/lib/chargen/rules/veteran";
import {
  canonicalTalentGroupVariant,
  talentGroupVariantOptions,
} from "@/lib/chargen/rules/talentGroupVariants";
import LearningMethodSelect from "@/components/chargen/LearningMethodSelect";

const selectClass =
  "rounded border border-surface-border bg-[#2c251f] px-1.5 py-0.5 text-xs scheme-dark text-[#f2e8dc]";

export default function VeteranTraitsPanel({
  held,
  updateHeld,
  traits,
  talents = [],
  learningMethod,
  onLearningMethodChange,
  labelMap,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  traits: CatalogItem[];
  talents?: CatalogItem[];
  learningMethod: LearningMethod;
  onLearningMethodChange: (m: LearningMethod) => void;
  labelMap: Record<string, string>;
}) {
  const owned = held.advantagesDisadvantages
    .map((t) => {
      const meta = traits.find((x) => x.id === t.id);
      return { row: t, meta };
    })
    .filter((x) => x.meta);

  const disadvantages = owned.filter(
    (x) => x.meta?.kind === "disadvantage"
  );
  const groupOptions = talentGroupVariantOptions();

  function setVariant(traitId: string, variant: string) {
    updateHeld((h) => ({
      ...h,
      advantagesDisadvantages: h.advantagesDisadvantages.map((x) =>
        x.id === traitId ? { ...x, variant: variant || undefined } : x
      ),
    }));
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-lg font-bold">Advantages / Disadvantages</h2>
      <p className="text-sm text-ink-muted">
        Buy off or reduce disadvantages with AP (100 AP per GP of the
        disadvantage, unless noted). Advantages cannot be removed in veteran
        mode.
      </p>
      <LearningMethodSelect
        value={learningMethod}
        onChange={onLearningMethodChange}
        exclude={["mutual", "none"]}
      />
      {disadvantages.length === 0 ? (
        <p className="text-sm text-ink-faint">No disadvantages on this hero.</p>
      ) : (
        <ul className="space-y-2">
          {disadvantages.map(({ row, meta }) => {
            if (!meta) return null;
            const name = formatOwnedTraitName(row, (id) =>
              labelMap[id] || (id === row.id ? (meta.name as string) : id)
            );
            const staged =
              meta.gp_per_level != null && Number(meta.gp_per_level) < 0;
            const rating = row.rating ?? 1;
            const kostenKey = String(meta.kosten_key || "");
            const needsTalentVariant =
              kostenKey === "BEGABUNG_TALENT" ||
              kostenKey === "UNFAEHIGKEIT_TALENT";
            const needsGroupVariant =
              kostenKey === "BEGABUNG_TALENTGRUPPE" ||
              kostenKey === "UNFAEHIGKEIT_TALENTGRUPPE";
            const buyOff = disadvantageBuyOffCost(meta, rating, {
              held,
              variant: row.variant,
              talents,
            });
            const reduce = disadvantageReduceCost(meta, learningMethod);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm"
              >
                <span className="flex-1 min-w-[10rem] font-medium">{name}</span>
                {needsGroupVariant ? (
                  <label className="flex items-center gap-1 text-xs text-ink-muted">
                    <span className="sr-only">Talent group</span>
                    <select
                      className={selectClass}
                      value={canonicalTalentGroupVariant(row.variant) || ""}
                      onChange={(e) => setVariant(row.id, e.target.value)}
                    >
                      <option value="">Select talent group…</option>
                      {groupOptions.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {needsTalentVariant ? (
                  <label className="flex items-center gap-1 text-xs text-ink-muted">
                    <span className="sr-only">Talent</span>
                    <select
                      className={`${selectClass} max-w-[14rem]`}
                      value={row.variant || ""}
                      onChange={(e) => setVariant(row.id, e.target.value)}
                    >
                      <option value="">Select talent…</option>
                      {talents.map((tal) => (
                        <option key={tal.id} value={tal.id}>
                          {(tal.name as string) || tal.id}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {staged && rating > 1 ? (
                  <span className="text-ink-muted text-xs">Level {rating}</span>
                ) : null}
                {staged && rating > 1 ? (
                  <button
                    type="button"
                    className="px-2 py-1 rounded border border-surface-border text-xs hover:bg-surface-sidebar"
                    onClick={() =>
                      updateHeld((h) =>
                        reduceDisadvantageLevel(
                          h,
                          row.id,
                          meta,
                          learningMethod
                        )
                      )
                    }
                  >
                    Reduce (−1) — {reduce} AP
                  </button>
                ) : null}
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-red-900/60 text-red-200 text-xs hover:bg-red-950/40"
                  onClick={() =>
                    updateHeld((h) => buyOffDisadvantage(h, row.id, meta))
                  }
                >
                  {staged && rating > 1 ? "Remove all" : "Buy off"} — {buyOff}{" "}
                  AP
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {owned.filter((x) => x.meta?.kind === "advantage").length > 0 && (
        <div className="pt-4 border-t border-surface-border">
          <h3 className="text-sm font-semibold mb-2">Advantages (read-only)</h3>
          <ul className="flex flex-wrap gap-1.5">
            {owned
              .filter((x) => x.meta?.kind === "advantage")
              .map(({ row, meta }) => (
                <li
                  key={row.id}
                  className="rounded border border-surface-border px-2 py-0.5 text-xs"
                >
                  {formatOwnedTraitName(row, (id) =>
                    labelMap[id] || (id === row.id ? (meta?.name as string) || id : id)
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
