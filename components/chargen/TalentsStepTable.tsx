"use client";

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel, LearningMethod } from "@/lib/chargen/types";
import { isVeteranPhase } from "@/lib/chargen/types";
import { effectiveTalentTp } from "@/lib/chargen/rules/applyBausteine";
import {
  activateTalent,
  canActivateMoreTalents,
  canEditTalentValues,
  combatAtPaConflictMessage,
  countNonSeededActivations,
  deactivateTalent,
  lowerTalentTp,
  MAX_COMBAT_ATTACK,
  MAX_TALENT_ACTIVATIONS,
  raiseTalentTp,
  setTalentAttack,
  isTalentCheckboxChecked,
  isTalentOnHeld,
  talentAdvancementLabel,
  talentDisplayApCost,
  talentParade,
  usesAtPaDistribution,
} from "@/lib/chargen/rules/talentActivation";
import { formatTalentProbe } from "@/lib/chargen/rules/talentCaps";
import LearningMethodSelect from "@/components/chargen/LearningMethodSelect";
import {
  StickySectionHeader,
  chargenNestedListClass,
} from "@/components/chargen/ChargenScrollList";

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
  title,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className="px-1.5 py-0.5 rounded border border-surface-border disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function TalentsStepTable({
  held,
  updateHeld,
  talentsByGroup,
  seedTalentIdSet,
  seededTpMap,
  attributeMods,
  talentGroupLabel,
  learningMethod = "none",
  onLearningMethodChange,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  talentsByGroup: { id: string; items: CatalogItem[] }[];
  seedTalentIdSet: Set<string>;
  seededTpMap: Map<string, number>;
  attributeMods?: AttributeMods;
  talentGroupLabel: (group: string) => string;
  learningMethod?: LearningMethod;
  onLearningMethodChange?: (m: LearningMethod) => void;
}) {
  const veteran = isVeteranPhase(held);
  const activationCount = countNonSeededActivations(held, seedTalentIdSet);
  const atCap =
    !veteran && activationCount >= MAX_TALENT_ACTIVATIONS;

  return (
    <div className="max-w-5xl space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Talents (AP)</h2>
        {!veteran && (
          <p
            className={`text-sm ${atCap ? "text-amber-400" : "text-ink-muted"}`}
          >
            {activationCount} / {MAX_TALENT_ACTIVATIONS} talents activated
          </p>
        )}
      </div>
      {veteran && onLearningMethodChange ? (
        <LearningMethodSelect
          value={learningMethod}
          onChange={onLearningMethodChange}
        />
      ) : null}
      <p className="text-sm text-ink-muted">
        {veteran
          ? "Spend AP to activate and raise talents. Raises up to your loaded baseline are free until you save and reload."
          : "Basic talents and seeded talents from race, culture, and profession start known (checkbox locked) and can be raised without activation. Other talents must be activated first. Mother tongue / second language show CL creation modifiers (CL−2 / CL−4)."}
      </p>
      <div className={`${chargenNestedListClass} flex flex-col gap-4`}>
        {talentsByGroup.map(({ id: groupId, items }) => {
          const showCombatCols = groupId === "combat";
          return (
            <section key={groupId} className="relative z-0">
              <StickySectionHeader className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {talentGroupLabel(groupId)}
                <span className="ml-2 font-normal normal-case tracking-normal text-ink-faint">
                  ({items.length})
                </span>
              </StickySectionHeader>
              <div className="overflow-x-auto">
              <table
                className={`w-full text-sm border-collapse ${
                  showCombatCols ? "min-w-[36rem]" : "min-w-[20rem]"
                }`}
              >
                <thead>
                  <tr className="text-xs text-ink-muted border-b border-surface-border">
                    <th className="py-1 pr-2 text-left font-medium w-8" />
                    <th className="py-1 pr-2 text-left font-medium">Talent</th>
                    <th className="py-1 px-1 text-center font-medium w-12">
                      Adv.
                    </th>
                    <th className="py-1 px-1 text-center font-medium w-24">
                      Test
                    </th>
                    {showCombatCols && (
                      <>
                        <th className="py-1 px-1 text-center font-medium w-20">
                          AT
                        </th>
                        <th className="py-1 px-1 text-center font-medium w-20">
                          PA
                        </th>
                      </>
                    )}
                    <th className="py-1 px-1 text-center font-medium w-14">TP</th>
                    <th className="py-1 pl-2 text-right font-medium w-20">
                      Costs
                    </th>
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
                  {items.map((t) => {
                    const id = String(t.id);
                    const row = held.talents.find((x) => x.id === id);
                    const baseTp = row?.tp ?? 0;
                    const tp = effectiveTalentTp(
                      held,
                      id,
                      baseTp,
                      attributeMods
                    );
                    const seeded = seedTalentIdSet.has(id);
                    const checked = isTalentCheckboxChecked(
                      held,
                      t,
                      seedTalentIdSet
                    );
                    const editable = canEditTalentValues(
                      held,
                      t,
                      seedTalentIdSet
                    );
                    const minTp = veteran
                      ? 0
                      : (seededTpMap.get(id) ?? 0);
                    const attack = row?.attack ?? 0;
                    const showAtPa = showCombatCols && usesAtPaDistribution(t);
                    const pa = showAtPa
                      ? talentParade(held, id, baseTp, attack, attributeMods)
                      : null;
                    const atPaConflict =
                      showAtPa && editable
                        ? combatAtPaConflictMessage(attack, tp)
                        : null;
                    const canAtMinus = editable && attack > 0;
                    const canAtPlus =
                      editable && attack < MAX_COMBAT_ATTACK;
                    const cost = talentDisplayApCost(
                      held,
                      t,
                      seedTalentIdSet,
                      learningMethod
                    );
                    const canActivate =
                      veteran || canActivateMoreTalents(held, seedTalentIdSet);
                    const checkboxDisabled =
                      seeded || (!checked && !canActivate);
                    const checkboxTitle = atPaConflict
                      ? atPaConflict
                      : seeded
                        ? "Basic talent or granted by race, culture, or profession"
                        : atCap && !checked
                          ? `Maximum ${MAX_TALENT_ACTIVATIONS} activations`
                          : undefined;

                    return (
                      <tr
                        key={id}
                        className="border-b border-surface-border/40 hover:bg-surface-sidebar/40"
                      >
                        <td className="py-1 pr-2 align-middle">
                          <input
                            type="checkbox"
                            className={`rounded ${
                              atPaConflict ? "accent-red-500" : ""
                            }`}
                            checked={checked}
                            disabled={checkboxDisabled}
                            title={checkboxTitle}
                            onChange={(e) =>
                              updateHeld((h) =>
                                e.target.checked
                                  ? activateTalent(
                                      h,
                                      t,
                                      seedTalentIdSet,
                                      learningMethod
                                    )
                                  : deactivateTalent(h, t, seedTalentIdSet)
                              )
                            }
                          />
                        </td>
                        <td
                          className={`py-1 pr-2 align-middle truncate max-w-[12rem] ${
                            atPaConflict
                              ? "text-red-400 font-semibold"
                              : seeded
                                ? "font-semibold"
                                : ""
                          }`}
                          title={atPaConflict ?? undefined}
                        >
                          {(t.name as string) || id}
                          <CustomBadge source={t.source as string} />
                        </td>
                        <td className="py-1 px-1 text-center align-middle text-ink-muted font-mono text-xs">
                          {talentAdvancementLabel(held, t)}
                        </td>
                        <td className="py-1 px-1 text-center align-middle text-ink-muted font-mono text-xs whitespace-nowrap">
                          {formatTalentProbe(t)}
                        </td>
                        {showCombatCols && (
                          <>
                            <td className="py-1 px-1 text-center align-middle">
                              {!showAtPa ? (
                                <span className="text-ink-faint">—</span>
                              ) : (
                                <div className="flex items-center justify-center gap-0.5">
                                  <StepButton
                                    disabled={!canAtMinus}
                                    onClick={() =>
                                      updateHeld((h) =>
                                        setTalentAttack(
                                          h,
                                          t,
                                          seedTalentIdSet,
                                          attack - 1,
                                          attributeMods
                                        )
                                      )
                                    }
                                  >
                                    −
                                  </StepButton>
                                  <span className="w-6 text-center font-mono">
                                    {editable ? attack : "—"}
                                  </span>
                                  <StepButton
                                    disabled={!canAtPlus}
                                    onClick={() =>
                                      updateHeld((h) =>
                                        setTalentAttack(
                                          h,
                                          t,
                                          seedTalentIdSet,
                                          attack + 1,
                                          attributeMods
                                        )
                                      )
                                    }
                                  >
                                    +
                                  </StepButton>
                                </div>
                              )}
                            </td>
                            <td className="py-1 px-1 text-center align-middle font-mono">
                              {!showAtPa ? (
                                <span className="text-ink-faint">—</span>
                              ) : editable ? (
                                pa
                              ) : (
                                <span className="text-ink-faint">—</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="py-1 px-1 text-center align-middle">
                          <div className="flex items-center justify-center gap-0.5">
                            <StepButton
                              disabled={!editable || baseTp <= minTp}
                              title={
                                veteran && row && baseTp <= (row.baselineTp ?? 0)
                                  ? "Lowering below baseline refunds 0 AP after reload"
                                  : undefined
                              }
                              onClick={() =>
                                updateHeld((h) =>
                                  lowerTalentTp(
                                    h,
                                    t,
                                    seedTalentIdSet,
                                    learningMethod,
                                    minTp
                                  )
                                )
                              }
                            >
                              −
                            </StepButton>
                            <span
                              className={`w-8 text-center font-mono ${
                                editable ? "" : "text-ink-faint"
                              }`}
                            >
                              {checked ? tp : 0}
                            </span>
                            <StepButton
                              disabled={!editable}
                              onClick={() =>
                                updateHeld((h) =>
                                  raiseTalentTp(
                                    h,
                                    t,
                                    seedTalentIdSet,
                                    learningMethod
                                  )
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
                              disabled={!isTalentOnHeld(held, id)}
                              onChange={(e) => {
                                const on = e.target.checked;
                                updateHeld((h) => {
                                  if (!isTalentOnHeld(h, id)) return h;
                                  return {
                                    ...h,
                                    talents: h.talents.map((x) =>
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
