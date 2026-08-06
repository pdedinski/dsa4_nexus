"use client";

import type { AttributeMods, DerivedCode, HeldModel } from "@/lib/chargen/types";
import { derivedValue } from "@/lib/chargen/types";
import {
  baseValueZukaufCap,
  baseValueZukaufCost,
  isBaseValuePurchasable,
  lowerBaseValueZukauf,
  raiseBaseValueZukauf,
} from "@/lib/chargen/rules/veteran";

const LABELS: Partial<Record<DerivedCode, string>> = {
  VP: "Vitality Points (VP)",
  EP: "Endurance Points (EP)",
  RM: "Magic Resistance (RM)",
  ASP: "Magic Points (ASP)",
};

const PURCHASABLE: DerivedCode[] = ["VP", "EP", "RM", "ASP"];

export default function BaseValuesStepPanel({
  held,
  updateHeld,
  attributeMods,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  attributeMods?: AttributeMods;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-lg font-bold">Base values</h2>
      <p className="text-sm text-ink-muted">
        Buy VP, EP, RM, and ASP with AP. Costs use the SKT table by derived
        value type (Java Basiswerte Steigern).
      </p>
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-ink-muted text-left">
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-2 py-2 font-medium text-right">Current</th>
              <th className="px-2 py-2 font-medium text-center">Bought</th>
              <th className="px-2 py-2 font-medium text-right">Cap</th>
              <th className="px-3 py-2 font-medium text-right">Next AP</th>
            </tr>
          </thead>
          <tbody>
            {PURCHASABLE.map((code) => {
              if (!isBaseValuePurchasable(code)) return null;
              const row = held.derived.find((d) => d.code === code);
              const purchased = row?.purchased ?? 0;
              const cap = baseValueZukaufCap(held, code, attributeMods);
              const nextCost = baseValueZukaufCost(
                held,
                code,
                row?.specialExperience
              );
              const current = derivedValue(held, code);
              return (
                <tr
                  key={code}
                  className="border-b border-surface-border/60 last:border-0"
                >
                  <td className="px-3 py-2">{LABELS[code] ?? code}</td>
                  <td className="px-2 py-2 text-right font-mono">{current}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                        disabled={purchased <= 0}
                        onClick={() =>
                          updateHeld((h) => lowerBaseValueZukauf(h, code))
                        }
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-mono">
                        {purchased}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                        disabled={purchased >= cap}
                        onClick={() =>
                          updateHeld((h) =>
                            raiseBaseValueZukauf(h, code, attributeMods)
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-ink-muted">
                    {cap}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {purchased >= cap ? "—" : `${nextCost} AP`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
