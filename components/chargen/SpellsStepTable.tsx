"use client";

import { useMemo } from "react";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel, LearningMethod } from "@/lib/chargen/types";
import { isVeteranPhase } from "@/lib/chargen/types";
import {
  addOrRaiseSpell,
  isCastableSpell,
  isSpellOnHeld,
  lowerOrRemoveSpell,
  spellAdvancementLabel,
  spellDisplayApCost,
} from "@/lib/chargen/rules/spellActivation";
import { spellBlockReason, spellcasterBlocked } from "@/lib/chargen/rules/spellPrereqs";
import { formatTalentProbe } from "@/lib/chargen/rules/talentCaps";
import LearningMethodSelect from "@/components/chargen/LearningMethodSelect";

function CustomBadge({ source }: { source?: string }) {
  if (!source || source === "builtin") return null;
  return (
    <span className="ml-1 text-[10px] uppercase text-ink-faint">({source})</span>
  );
}

function StepButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="px-1.5 py-0.5 rounded border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function SpellsStepTable({
  held,
  updateHeld,
  spells,
  learningMethod = "none",
  onLearningMethodChange,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  spells: CatalogItem[];
  learningMethod?: LearningMethod;
  onLearningMethodChange?: (m: LearningMethod) => void;
}) {
  const veteran = isVeteranPhase(held);
  const castableSpells = useMemo(
    () => spells.filter(isCastableSpell),
    [spells]
  );

  return (
    <div className="max-w-5xl space-y-3">
      <h2 className="text-lg font-bold">Spells (AP)</h2>
      {veteran && onLearningMethodChange ? (
        <LearningMethodSelect
          value={learningMethod}
          onChange={onLearningMethodChange}
        />
      ) : null}
      {!veteran && spellcasterBlocked(held) && (
        <p className="text-sm text-amber-400/90">
          Spells require the Spellcaster advantage (20 GP). Without it, no spell
          points can be allocated during creation.
        </p>
      )}
      <p className="text-sm text-ink-muted">
        {veteran
          ? "Spend AP to activate and raise spells. Raises up to your loaded baseline are free until you save and reload."
          : "Activate spells and raise Spell Prowess (SP). Adv. is the SKT column; Test shows the three attributes for the spell check."}
      </p>
      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-ink-muted border-b border-surface-border sticky top-0 bg-[#1a1410] z-10">
              <th className="py-1 pr-2 text-left font-medium">Spell</th>
              <th className="py-1 px-1 text-center font-medium w-12">Adv.</th>
              <th className="py-1 px-1 text-center font-medium w-24">Test</th>
              <th className="py-1 px-1 text-center font-medium w-14">SP</th>
              <th className="py-1 pl-2 text-right font-medium w-20">Costs</th>
              {veteran && (
                <th
                  className="py-1 pl-2 text-center font-medium w-10"
                  title="Special Experience"
                >
                  SE
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {castableSpells.map((s) => {
              const id = String(s.id);
              const row = held.spells.find((x) => x.id === id);
              const sp = row?.sp ?? 0;
              const blockReason = spellBlockReason(held, s);
              const blocked = !veteran && !row && blockReason !== null;
              const onHeld = !!row;
              const cost = spellDisplayApCost(held, s, learningMethod);
              const canPlus = !(blocked && !row);

              return (
                <tr
                  key={id}
                  className={`border-b border-surface-border/40 ${
                    blocked
                      ? "opacity-50"
                      : "hover:bg-surface-sidebar/40"
                  }`}
                  title={blockReason ?? undefined}
                >
                  <td
                    className={`py-1 pr-2 align-middle truncate max-w-[14rem] ${
                      blocked ? "text-red-400" : ""
                    }`}
                  >
                    {(s.name as string) || id}
                    <CustomBadge source={s.source as string} />
                  </td>
                  <td className="py-1 px-1 text-center align-middle text-ink-muted font-mono text-xs">
                    {spellAdvancementLabel(held, s)}
                  </td>
                  <td className="py-1 px-1 text-center align-middle text-ink-muted font-mono text-xs whitespace-nowrap">
                    {formatTalentProbe(s)}
                  </td>
                  <td className="py-1 px-1 text-center align-middle">
                    <div className="flex items-center justify-center gap-0.5">
                      <StepButton
                        disabled={!onHeld}
                        onClick={() =>
                          updateHeld((h) =>
                            lowerOrRemoveSpell(h, s, learningMethod)
                          )
                        }
                      >
                        −
                      </StepButton>
                      <span className="w-8 text-center font-mono">{sp}</span>
                      <StepButton
                        disabled={!canPlus}
                        onClick={() =>
                          updateHeld((h) =>
                            addOrRaiseSpell(h, s, learningMethod)
                          )
                        }
                      >
                        +
                      </StepButton>
                    </div>
                  </td>
                  <td className="py-1 pl-2 text-right align-middle font-mono text-xs whitespace-nowrap">
                    {cost} AP
                  </td>
                  {veteran && (
                    <td className="py-1 pl-2 text-center align-middle">
                      <input
                        type="checkbox"
                        className="rounded"
                        title="Special Experience"
                        checked={row?.specialExperience === true}
                        disabled={!isSpellOnHeld(held, id)}
                        onChange={(e) => {
                          const on = e.target.checked;
                          updateHeld((h) => {
                            if (!isSpellOnHeld(h, id)) return h;
                            return {
                              ...h,
                              spells: h.spells.map((x) =>
                                x.id === id
                                  ? { ...x, specialExperience: on }
                                  : x
                              ),
                            };
                          });
                        }}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
