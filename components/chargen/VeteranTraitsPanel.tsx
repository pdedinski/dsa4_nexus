"use client";

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel, LearningMethod } from "@/lib/chargen/types";
import { formatTraitMeta } from "@/lib/chargen/rules/traitLabels";
import {
  buyOffDisadvantage,
  disadvantageBuyOffCost,
  disadvantageReduceCost,
  reduceDisadvantageLevel,
} from "@/lib/chargen/rules/veteran";
import LearningMethodSelect from "@/components/chargen/LearningMethodSelect";

export default function VeteranTraitsPanel({
  held,
  updateHeld,
  traits,
  learningMethod,
  onLearningMethodChange,
  labelMap,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  traits: CatalogItem[];
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
            const name = labelMap[row.id] || (meta.name as string) || row.id;
            const staged =
              meta.gp_per_level != null && Number(meta.gp_per_level) < 0;
            const rating = row.rating ?? 1;
            const buyOff = disadvantageBuyOffCost(meta, rating);
            const reduce = disadvantageReduceCost(meta, learningMethod);
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm"
              >
                <span className="flex-1 min-w-[10rem] font-medium">{name}</span>
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
          <p className="text-sm text-ink-muted">
            {owned
              .filter((x) => x.meta?.kind === "advantage")
              .map(({ row, meta }) =>
                formatTraitMeta(
                  {
                    kind: "advantage",
                    gp_cost: meta?.gp_cost as number | null,
                    gp_per_level: meta?.gp_per_level as number | null,
                  },
                  {}
                )
                  ? `${labelMap[row.id] || row.id}`
                  : labelMap[row.id] || row.id
              )
              .join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
