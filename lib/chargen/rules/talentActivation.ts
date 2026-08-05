/**
 * Talent activation during creation — mirrors Java `PanelTalenteListe` /
 * `PanelKampftechnikenListe` and `Held.einfuegen` / `deaktivieren`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel, TalentWert } from "@/lib/chargen/types";
import { effectiveTalentTp } from "@/lib/chargen/rules/applyBausteine";
import { resolveTalentSktColumn } from "@/lib/chargen/rules/sktColumn";
import { apToRaise, sktActivationCost, sktColumnLabel } from "@/lib/chargen/rules/kosten";

export const MAX_TALENT_ACTIVATIONS = 5;

export function isBasicTalent(talent: CatalogItem): boolean {
  return talent.is_basic === true || talent.type === "basis";
}

export function isCombatTalent(talent: CatalogItem): boolean {
  return talent.combat === true || talent.group === "combat";
}

export function isRangedCombatTalent(talent: CatalogItem): boolean {
  return isCombatTalent(talent) && talent.ranged === true;
}

export function talentRow(
  held: HeldModel,
  talentId: string
): TalentWert | undefined {
  return held.talents.find((t) => t.id === talentId);
}

export function isTalentOnHeld(held: HeldModel, talentId: string): boolean {
  return held.talents.some((t) => t.id === talentId);
}

/** Java `TalentWert.istAktiviert()` — usable for TP/AT editing. */
export function isTalentActivated(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): boolean {
  if (isBasicTalent(talent)) return true;
  const row = talentRow(held, String(talent.id));
  if (!row) return false;
  if (row.activated === false) return false;
  if (row.activated === true) return true;
  if (seededIds.has(String(talent.id))) return true;
  if (row.tp > 0 || (row.attack ?? 0) > 0) return true;
  return false;
}

/** Checkbox checked state (combat uses on-held; others use activated). */
export function isTalentCheckboxChecked(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): boolean {
  if (!isTalentOnHeld(held, String(talent.id))) return false;
  if (isCombatTalent(talent)) return true;
  return isTalentActivated(held, talent, seededIds);
}

export function canEditTalentValues(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): boolean {
  if (!isTalentOnHeld(held, String(talent.id))) return false;
  return isTalentActivated(held, talent, seededIds);
}

/** Java `Held.getAnzahlAktivierteTalente()` — non-vorgegeben talents on held. */
export function countNonSeededActivations(
  held: HeldModel,
  seededIds: Set<string>
): number {
  let count = 0;
  for (const t of held.talents) {
    if (!seededIds.has(t.id)) count += 1;
  }
  return count;
}

export function talentParade(
  held: HeldModel,
  talentId: string,
  baseTp: number,
  attack: number,
  attributeMods?: AttributeMods
): number {
  const eff = effectiveTalentTp(held, talentId, baseTp, attributeMods);
  return eff - attack;
}

export function talentDisplayApCost(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): number {
  const id = String(talent.id);
  const row = talentRow(held, id);
  const col = resolveTalentSktColumn(held, talent);
  if (!row || !isTalentActivated(held, talent, seededIds)) {
    return sktActivationCost(col);
  }
  return apToRaise(col, row.tp, row.tp + 1);
}

export function talentAdvancementLabel(
  held: HeldModel,
  talent: CatalogItem
): string {
  return sktColumnLabel(resolveTalentSktColumn(held, talent));
}

/** Total AP spent on a talent row (activation + raises). */
export function talentRowApSpent(
  row: TalentWert,
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): number {
  const col = resolveTalentSktColumn(held, talent);
  let sum = apToRaise(col, 0, row.tp);
  if (
    !isBasicTalent(talent) &&
    !seededIds.has(row.id) &&
    row.activated !== false
  ) {
    sum += sktActivationCost(col);
  }
  return sum;
}

export function activateTalent(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): HeldModel {
  const id = String(talent.id);
  if (isTalentOnHeld(held, id)) {
    const row = talentRow(held, id)!;
    if (isTalentActivated(held, talent, seededIds)) return held;
    return {
      ...held,
      talents: held.talents.map((t) =>
        t.id === id ? { ...t, activated: true } : t
      ),
    };
  }
  const col = resolveTalentSktColumn(held, talent);
  const activationCost =
    seededIds.has(id) || isBasicTalent(talent) ? 0 : sktActivationCost(col);
  return {
    ...held,
    talents: [
      ...held.talents,
      {
        id,
        tp: 0,
        activated: isBasicTalent(talent) ? undefined : true,
      },
    ],
    apSpent: held.apSpent + activationCost,
  };
}

export function deactivateTalent(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): HeldModel {
  const id = String(talent.id);
  const row = talentRow(held, id);
  if (!row) return held;

  const refund = talentRowApSpent(row, held, talent, seededIds);
  return {
    ...held,
    talents: held.talents.filter((t) => t.id !== id),
    apSpent: Math.max(0, held.apSpent - refund),
  };
}

export function raiseTalentTp(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): HeldModel {
  const id = String(talent.id);
  if (!canEditTalentValues(held, talent, seededIds)) return held;
  const row = talentRow(held, id);
  if (!row) return held;
  const col = resolveTalentSktColumn(held, talent);
  const from = row.tp;
  const cost = apToRaise(col, from, from + 1);
  return {
    ...held,
    talents: held.talents.map((t) =>
      t.id === id ? { ...t, tp: from + 1 } : t
    ),
    apSpent: held.apSpent + cost,
  };
}

export function lowerTalentTp(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>,
  minTp = 0
): HeldModel {
  const id = String(talent.id);
  const row = talentRow(held, id);
  if (!row || row.tp <= minTp) return held;
  const col = resolveTalentSktColumn(held, talent);
  const from = row.tp;
  const cost = apToRaise(col, from - 1, from);
  const nextAttack = Math.min(row.attack ?? 0, from - 1);
  return {
    ...held,
    talents: held.talents.map((t) =>
      t.id === id ? { ...t, tp: from - 1, attack: nextAttack } : t
    ),
    apSpent: Math.max(0, held.apSpent - cost),
  };
}

export function setTalentAttack(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>,
  attack: number
): HeldModel {
  const id = String(talent.id);
  if (!canEditTalentValues(held, talent, seededIds)) return held;
  const row = talentRow(held, id);
  if (!row) return held;
  const clamped = Math.max(0, Math.min(row.tp, attack));
  return {
    ...held,
    talents: held.talents.map((t) =>
      t.id === id ? { ...t, attack: clamped } : t
    ),
  };
}
