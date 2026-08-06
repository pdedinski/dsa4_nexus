"use client";

import type {
  AttributeMods,
  AttrCodeWithSo,
  HeldModel,
  LearningMethod,
} from "@/lib/chargen/types";
import { ATTR_LABELS, currentAttrValue } from "@/lib/chargen/types";
import {
  attributeZukaufCap,
  attributeZukaufCost,
  lowerAttributeZukauf,
  raiseAttributeZukauf,
} from "@/lib/chargen/rules/veteran";
import LearningMethodSelect from "@/components/chargen/LearningMethodSelect";

export default function VeteranAttributesPanel({
  held,
  updateHeld,
  attributeMods,
  learningMethod,
  onLearningMethodChange,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  attributeMods?: AttributeMods;
  learningMethod: LearningMethod;
  onLearningMethodChange: (m: LearningMethod) => void;
}) {
  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-lg font-bold">Attributes</h2>
      <p className="text-sm text-ink-muted">
        Raise attributes with AP (zukauf). Cap is half the start value
        (creation base + race/culture/profession mods). Creation base is
        locked.
      </p>
      <LearningMethodSelect
        value={learningMethod}
        onChange={onLearningMethodChange}
        exclude={["self_study"]}
      />
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-ink-muted text-left">
              <th className="px-3 py-2 font-medium">Attribute</th>
              <th className="px-2 py-2 font-medium text-right">Current</th>
              <th className="px-2 py-2 font-medium text-center">Bought</th>
              <th className="px-2 py-2 font-medium text-right">Cap</th>
              <th className="px-3 py-2 font-medium text-right">Next AP</th>
            </tr>
          </thead>
          <tbody>
            {held.attributes
              .filter((a) => a.code !== "SO")
              .map((a) => {
                const code = a.code as AttrCodeWithSo;
                const cap = attributeZukaufCap(held, code, attributeMods);
                const nextCost = attributeZukaufCost(
                  held,
                  code,
                  attributeMods,
                  learningMethod,
                  a.specialExperience
                );
                const current = currentAttrValue(held, code, attributeMods);
                return (
                  <tr
                    key={a.code}
                    className="border-b border-surface-border/60 last:border-0"
                  >
                    <td className="px-3 py-2">
                      {ATTR_LABELS[a.code]}
                      <span className="text-ink-faint text-xs ml-1">
                        (base {a.base})
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {current}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                          disabled={a.purchased <= 0}
                          onClick={() =>
                            updateHeld((h) =>
                              lowerAttributeZukauf(
                                h,
                                code,
                                attributeMods,
                                learningMethod
                              )
                            )
                          }
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-mono">
                          {a.purchased}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                          disabled={a.purchased >= cap}
                          onClick={() =>
                            updateHeld((h) =>
                              raiseAttributeZukauf(
                                h,
                                code,
                                attributeMods,
                                learningMethod
                              )
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
                      {a.purchased >= cap ? "—" : `${nextCost} AP`}
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
