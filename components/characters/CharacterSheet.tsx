"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { CharacterSheet as Sheet, SheetLoadoutArmor } from "@/lib/character/types";
import {
  computeAllLoadoutWeaponLines,
  totalLoadoutEC,
} from "@/lib/character/loadoutCombatValues";
import { migrateCharacterSheet } from "@/lib/character/sheetMigration";
import { humanizeSnake } from "@/lib/display/humanize";
import CodexEntryPeekModal, {
  type CodexPeekTarget,
} from "@/components/characters/CodexEntryPeekModal";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 border border-surface-border rounded-lg overflow-hidden bg-surface-card">
      <h3 className="text-sm font-bold uppercase tracking-wide bg-brand-muted px-3 py-2 text-ink border-b border-surface-border">
        {title}
      </h3>
      <div className="p-3 text-sm text-ink">{children}</div>
    </section>
  );
}

function CodexLink({
  children,
  onOpen,
  className = "",
}: {
  children: ReactNode;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`text-left text-ink underline decoration-surface-border decoration-1 underline-offset-2 hover:decoration-brand hover:text-brand-muted ${className}`}
    >
      {children}
    </button>
  );
}

export default function CharacterSheet({ sheet }: { sheet: Sheet }) {
  const sheetM = useMemo(() => migrateCharacterSheet(sheet), [sheet]);
  const loadoutWeaponLines = useMemo(() => {
    const lo = sheetM.loadout;
    if (!lo?.weapons?.length) return [];
    return computeAllLoadoutWeaponLines(sheetM, lo);
  }, [sheetM]);
  const loadoutTotalEc = useMemo(
    () => totalLoadoutEC(sheetM.loadout?.armors),
    [sheetM.loadout?.armors]
  );
  const MIN_ARMOR_TABLE_ROWS = 5;
  const loadoutArmorTable = useMemo(() => {
    const list = sheetM.loadout?.armors ?? [];
    const sumAr = list.reduce((s, a) => s + a.ar, 0);
    const sumEcRaw = list.reduce((s, a) => s + a.ec, 0);
    const sumIni = list.reduce((s, a) => s + a.iniModifier, 0);
    const totalEcDisplay = list.length > 0 ? Math.max(0, sumEcRaw - 1) : 0;
    const slots: (SheetLoadoutArmor | null)[] = [...list];
    while (slots.length < MIN_ARMOR_TABLE_ROWS) slots.push(null);
    return { slots, sumAr, sumIni, totalEcDisplay };
  }, [sheetM.loadout?.armors]);
  const hideCombatTalentTables =
    (sheetM.loadout?.weapons?.length ?? 0) > 0;
  const h = sheetM.header;
  const a = sheetM.attributesFinal;
  const [peek, setPeek] = useState<CodexPeekTarget | null>(null);

  const talentsByGroup = useMemo(() => {
    const m = new Map<string, typeof sheetM.talents>();
    for (const t of sheetM.talents) {
      const arr = m.get(t.group) ?? [];
      arr.push(t);
      m.set(t.group, arr);
    }
    return [...m.entries()]
      .sort(([ga], [gb]) => ga.localeCompare(gb))
      .map(([group, rows]) => ({
        group,
        label: humanizeSnake(group),
        rows: rows.slice().sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [sheetM.talents]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 text-ink font-serif">
      <CodexEntryPeekModal target={peek} onClose={() => setPeek(null)} />

      <header className="border-b-2 border-brand pb-4 mb-6">
        <h1 className="text-3xl font-bold">{h.displayName}</h1>
        <p className="text-ink-muted mt-1">
          {h.raceName} · {h.cultureName} · {h.professionName}
        </p>
        <p className="text-xs text-ink-faint mt-1">
          Concept: {humanizeSnake(h.conceptId)} · {h.gender} · {h.ageYears}{" "}
          years
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Attributes">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-muted">CO</dt>
            <dd>{a.CO}</dd>
            <dt className="text-ink-muted">CL</dt>
            <dd>{a.CL}</dd>
            <dt className="text-ink-muted">IN</dt>
            <dd>{a.IN}</dd>
            <dt className="text-ink-muted">CH</dt>
            <dd>{a.CH}</dd>
            <dt className="text-ink-muted">DE</dt>
            <dd>{a.DE}</dd>
            <dt className="text-ink-muted">AG</dt>
            <dd>{a.AG}</dd>
            <dt className="text-ink-muted">CN</dt>
            <dd>{a.CN}</dd>
            <dt className="text-ink-muted">ST</dt>
            <dd>{a.ST}</dd>
            <dt className="text-ink-muted">SO</dt>
            <dd>{a.SO}</dd>
          </dl>
        </Section>

        <Section title="Derived values">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-muted">VP</dt>
            <dd>{sheetM.derived.VP}</dd>
            <dt className="text-ink-muted">EP</dt>
            <dd>{sheetM.derived.EP}</dd>
            <dt className="text-ink-muted">WT</dt>
            <dd>{sheetM.derived.WT}</dd>
            <dt className="text-ink-muted">
              Base AT / PA /{" "}
              <abbr title="Base Ranged Value (German: FK-Basiswert)">BRV</abbr>
            </dt>
            <dd>
              {sheetM.derived.baseAT} / {sheetM.derived.basePA} /{" "}
              {sheetM.derived.baseBRV}
            </dd>
            <dt className="text-ink-muted">Base INI</dt>
            <dd>{sheetM.derived.baseINI}</dd>
            <dt className="text-ink-muted">RM</dt>
            <dd>{sheetM.derived.RM}</dd>
            <dt className="text-ink-muted">ASP</dt>
            <dd>{sheetM.derived.ASP}</dd>
            <dt className="text-ink-muted">GS</dt>
            <dd>{sheetM.derived.GS}</dd>
          </dl>
        </Section>
      </div>

      <Section title="Advantages & disadvantages">
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Automatic advantages
        </p>
        <ul className="list-none pl-0 mb-2 space-y-1">
          {sheetM.automaticAdvantages.map((x, i) => (
            <li key={`auto-adv-${x.id}-${i}`}>
              <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
              </CodexLink>
            </li>
          ))}
        </ul>
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Chosen advantages
        </p>
        <ul className="list-none pl-0 mb-2 space-y-1">
          {sheetM.chosenAdvantages.map((x, i) => (
            <li key={`chosen-adv-${x.id}-${i}`}>
              <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
              </CodexLink>
            </li>
          ))}
        </ul>
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Automatic disadvantages
        </p>
        <ul className="list-none pl-0 mb-2 space-y-1">
          {sheetM.automaticDisadvantages.map((x, i) => (
            <li key={`auto-dis-${x.id}-${x.rating ?? ""}-${i}`}>
              {x.pick_one_disadvantages &&
              x.pick_one_disadvantages.length > 0 ? (
                <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-1">
                  <span className="text-ink-muted shrink-0">Choose one:</span>
                  {x.pick_one_disadvantages.map((alt, j) => (
                    <span
                      key={`${alt.id}-${j}`}
                      className="inline-flex items-baseline gap-1"
                    >
                      {j > 0 ? (
                        <span className="text-ink-muted"> · or · </span>
                      ) : null}
                      <CodexLink
                        onOpen={() =>
                          setPeek({ kind: "trait", id: alt.id })
                        }
                      >
                        {humanizeSnake(alt.id)}
                        {alt.rating != null ? ` (${alt.rating})` : ""}
                      </CodexLink>
                    </span>
                  ))}
                  {x.note ? (
                    <span className="text-ink-muted text-xs"> — {x.note}</span>
                  ) : null}
                </span>
              ) : (
                <>
                  <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                    {x.name ?? humanizeSnake(x.id)}
                    {x.rating != null ? ` (${x.rating})` : ""}
                  </CodexLink>
                  {x.note ? (
                    <span className="text-ink-muted text-xs"> — {x.note}</span>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Chosen disadvantages
        </p>
        <ul className="list-none pl-0 space-y-1">
          {sheetM.chosenDisadvantages.map((x, i) => (
            <li key={`chosen-dis-${x.id}-${x.rating ?? ""}-${i}`}>
              <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
                {x.rating != null ? ` (${x.rating})` : ""}
              </CodexLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Special abilities">
        <ul className="list-none pl-0 space-y-1">
          {sheetM.specialAbilities.map((x) => (
            <li key={x.id + (x.note ?? "")}>
              <CodexLink onOpen={() => setPeek({ kind: "sa", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
              </CodexLink>
              {x.note ? (
                <span className="text-ink-muted text-xs"> — {x.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Talents">
        <div className="space-y-5">
          {talentsByGroup.map(({ group, label, rows }) => (
            <div key={group}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-brand-muted mb-2 border-b border-surface-border pb-1">
                {label}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-ink-muted">
                      <th className="py-1 pr-2">Talent</th>
                      <th className="py-1 font-mono text-right">TP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-surface-border/60"
                      >
                        <td className="py-1 pr-2">
                          <CodexLink
                            onOpen={() =>
                              setPeek({ kind: "talent", id: t.id })
                            }
                          >
                            {t.name}
                          </CodexLink>
                        </td>
                        <td className="py-1 font-mono text-right">{t.tp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {sheetM.spells.length > 0 && (
        <Section title="Spells">
          <ul className="list-none pl-0 space-y-1">
            {sheetM.spells.map((s) => (
              <li key={s.id}>
                <CodexLink onOpen={() => setPeek({ kind: "spell", id: s.id })}>
                  {s.name}
                </CodexLink>
                <span className="text-ink-muted"> — SP {s.sp}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!hideCombatTalentTables && (
        <div className="grid md:grid-cols-2 gap-4">
          {sheetM.combatMelee.length > 0 && (
            <Section title="Melee combat">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-muted text-left">
                    <th className="pb-1">Weapon talent</th>
                    <th>TP</th>
                    <th>AT</th>
                    <th>PA</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetM.combatMelee.map((c) => (
                    <tr
                      key={c.talentId}
                      className="border-t border-surface-border/60"
                    >
                      <td className="py-1">
                        <CodexLink
                          onOpen={() =>
                            setPeek({ kind: "talent", id: c.talentId })
                          }
                        >
                          {c.talentName}
                        </CodexLink>
                      </td>
                      <td>{c.tp}</td>
                      <td>{c.finalAT}</td>
                      <td>{c.finalPA}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
          {sheetM.combatRanged.length > 0 && (
            <Section title="Ranged combat">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-muted text-left">
                    <th className="pb-1">Talent</th>
                    <th>TP</th>
                    <th>AT</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetM.combatRanged.map((c) => (
                    <tr
                      key={c.talentId}
                      className="border-t border-surface-border/60"
                    >
                      <td className="py-1">
                        <CodexLink
                          onOpen={() =>
                            setPeek({ kind: "talent", id: c.talentId })
                          }
                        >
                          {c.talentName}
                        </CodexLink>
                      </td>
                      <td>{c.tp}</td>
                      <td>{c.finalAT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}

      {sheetM.loadout &&
        ((sheetM.loadout.weapons?.length ?? 0) > 0 ||
          (sheetM.loadout.armors?.length ?? 0) > 0) && (
        <Section title="Chosen loadout (wizard)">
          <div className="space-y-5 text-sm">
            {(sheetM.loadout.weapons?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted mb-2">
                  Weapons (final AT / PA / INI)
                </p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs border-collapse min-w-[20rem]">
                    <thead>
                      <tr className="text-left text-ink-muted border-b border-surface-border/80">
                        <th className="py-1.5 pr-2 font-semibold">Weapon</th>
                        <th className="py-1.5 pr-2 text-right font-semibold tabular-nums w-[3rem]">
                          AT
                        </th>
                        <th className="py-1.5 pr-2 text-right font-semibold tabular-nums w-[3rem]">
                          PA
                        </th>
                        <th className="py-1.5 pr-2 text-right font-semibold tabular-nums w-[3rem]">
                          INI
                        </th>
                        <th className="py-1.5 pl-2 font-semibold min-w-[6rem]">
                          Damage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadoutWeaponLines.map((row) => (
                        <tr
                          key={row.weaponId}
                          className="border-b border-surface-border/50 align-top"
                        >
                          <td className="py-2 pr-2">
                            <CodexLink
                              onOpen={() =>
                                setPeek({ kind: "equipment", id: row.weaponId })
                              }
                            >
                              {row.weaponName}
                            </CodexLink>
                            {row.notes.length > 0 ? (
                              <ul className="mt-1 list-disc pl-4 m-0 text-ink-faint text-[11px] leading-snug">
                                {row.notes.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-ink pr-2">
                            {row.finalAT}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-ink pr-2">
                            {row.finalPA === null ? "—" : row.finalPA}
                          </td>
                          <td className="py-2 text-right font-mono tabular-nums text-ink pr-2">
                            {row.ini}
                          </td>
                          <td className="py-2 pl-2 align-top max-w-[12rem]">
                            <div className="font-mono text-ink break-words">
                              {row.damage ?? "—"}
                            </div>
                            {row.damageStrengthNote ? (
                              <p className="mt-0.5 m-0 text-[10px] text-ink-faint leading-snug">
                                {row.damageStrengthNote}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-ink-faint leading-relaxed">
                  Damage uses final ST from the sheet plus the weapon&apos;s TP/ST rule from the codex
                  (<span className="font-mono">tp_kk</span>) where present; dice are unchanged, bonus TP is
                  added to the fixed modifier. WM tilt on TP split (PA−AT Σ per talent, then{" "}
                  <span className="font-mono">atPaBias</span> tie-break), shield WM,
                  INI = base + Σ armor INI + weapon INI, eBE from raw ΣEC{" "}
                  <strong>{loadoutTotalEc}</strong> (melee eBE split; ranged/jousting full
                  from AT). RS stacking not modeled.
                </p>
              </div>
            )}
            {(sheetM.loadout.armors?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted mb-2">
                  Armor & shields
                </p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs border-collapse border border-surface-border min-w-[16rem]">
                    <thead>
                      <tr className="bg-surface-sidebar/40 border-b-2 border-surface-border text-left">
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold">
                          Armor
                        </th>
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold text-center w-[3.5rem]">
                          AR
                        </th>
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold text-center w-[3.5rem]">
                          EC
                        </th>
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold text-center w-[3.5rem]">
                          INI
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadoutArmorTable.slots.map((ar, idx) => (
                        <tr
                          key={ar?.id ?? `slot-${idx}`}
                          className="border-b border-surface-border/60"
                        >
                          <td className="border-x border-surface-border/50 px-2 py-1.5 align-middle">
                            {ar ? (
                              <CodexLink
                                onOpen={() =>
                                  setPeek({ kind: "equipment", id: ar.id })
                                }
                              >
                                {ar.name}
                              </CodexLink>
                            ) : (
                              <span className="text-ink-faint">&nbsp;</span>
                            )}
                          </td>
                          <td className="border-x border-surface-border/50 px-2 py-1.5 text-center font-mono tabular-nums">
                            {ar ? ar.ar : ""}
                          </td>
                          <td className="border-x border-surface-border/50 px-2 py-1.5 text-center font-mono tabular-nums">
                            {ar ? ar.ec : ""}
                          </td>
                          <td className="border-x border-surface-border/50 px-2 py-1.5 text-center font-mono tabular-nums">
                            {ar ? (
                              <>
                                {ar.iniModifier >= 0 ? "+" : ""}
                                {ar.iniModifier}
                              </>
                            ) : (
                              ""
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-surface-border bg-surface-sidebar/30 font-semibold">
                        <td className="border-x border-surface-border/50 px-2 py-2">
                          Total
                        </td>
                        <td className="border-x border-surface-border/50 px-2 py-2 text-center font-mono tabular-nums">
                          {loadoutArmorTable.sumAr}
                        </td>
                        <td className="border-x border-surface-border/50 px-2 py-2 text-center font-mono tabular-nums">
                          {loadoutArmorTable.totalEcDisplay}
                        </td>
                        <td className="border-x border-surface-border/50 px-2 py-2 text-center font-mono tabular-nums">
                          {loadoutArmorTable.sumIni >= 0 ? "+" : ""}
                          {loadoutArmorTable.sumIni}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[11px] text-ink-faint leading-relaxed">
                  Total EC shows max(0, ΣEC−1) as a simple outfit adjustment for display;
                  combat eBE in the weapon table still uses raw ΣEC ({loadoutTotalEc}).
                  Total AR is the sum of piece RS (stacking rules not modeled).
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Equipment & wealth">
        <p className="mb-2">
          Starting money:{" "}
          <strong>{sheetM.startingMoneySilbertaler}</strong> Silbertaler (SO²)
        </p>
        <ul className="list-none pl-0 text-xs space-y-1">
          {sheetM.startingEquipment.map((id) => (
            <li key={id}>
              <CodexLink
                onOpen={() => setPeek({ kind: "equipment", id })}
                className="font-mono text-xs"
              >
                {humanizeSnake(id)}
              </CodexLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Appearance">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-ink-muted">Height</dt>
          <dd>{sheetM.physical.heightCm} cm</dd>
          <dt className="text-ink-muted">Weight</dt>
          <dd>{sheetM.physical.weightKg} kg</dd>
          <dt className="text-ink-muted">Hair / Eyes</dt>
          <dd>
            {sheetM.physical.hair} / {sheetM.physical.eyes}
          </dd>
        </dl>
      </Section>

      <Section title="Generation budgets">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
          <dt className="text-ink-muted">GP end</dt>
          <dd>{sheetM.budgets.gpEnd}</dd>
          <dt className="text-ink-muted">TGP spent / total</dt>
          <dd>
            {sheetM.budgets.tgpSpent} / {sheetM.budgets.tgpTotal}
          </dd>
          <dt className="text-ink-muted">SGP spent / total</dt>
          <dd>
            {sheetM.budgets.sgpSpent} / {sheetM.budgets.sgpTotal}
          </dd>
          <dt className="text-ink-muted">Extra AP applied</dt>
          <dd>{sheetM.budgets.extraApApplied}</dd>
        </dl>
      </Section>

      {sheetM.notes && sheetM.notes.length > 0 && (
        <div className="text-xs text-amber-700 dark:text-amber-400 mt-4 p-2 rounded bg-amber-950/20">
          {sheetM.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}
