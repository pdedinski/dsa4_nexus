/**
 * Talent activation during creation — mirrors Java `PanelTalenteListe` /
 * `PanelKampftechnikenListe` and `Held.einfuegen` / `deaktivieren`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type {
  AttributeMods,
  HeldModel,
  LearningMethod,
  TalentWert,
} from "@/lib/chargen/types";
import { isVeteranPhase, LEARNING_METHOD_COLUMN_SHIFT } from "@/lib/chargen/types";
import { effectiveTalentTp } from "@/lib/chargen/rules/applyBausteine";
import { resolveTalentSktColumn, languageRaiseApMultiplier } from "@/lib/chargen/rules/sktColumn";
import {
  activationCost,
  shiftColumn,
  sktColumnLabel,
  sktCost,
} from "@/lib/chargen/rules/kosten";

export const MAX_TALENT_ACTIVATIONS = 5;

/** Java `VoraussetzungKampftechnik.MAX_DIFFERENZ` — |AT − PA| must not exceed this. */
export const MAX_AT_PA_DIFF = 5;

export function isBasicTalent(talent: CatalogItem): boolean {
  return talent.is_basic === true || talent.type === "basis";
}

export function isCombatTalent(talent: CatalogItem): boolean {
  return talent.combat === true || talent.group === "combat";
}

export function isRangedCombatTalent(talent: CatalogItem): boolean {
  return isCombatTalent(talent) && talent.ranged === true;
}

/** Whether AT/PA split is legal for a given TP (PA = tp − attack). */
export function isValidCombatAtPa(attack: number, tp: number): boolean {
  return Math.abs(2 * attack - tp) <= MAX_AT_PA_DIFF;
}

/**
 * Clamp AT into [0, tp] and |AT − PA| ≤ {@link MAX_AT_PA_DIFF} (PA = tp − AT).
 * Mirrors Java `VoraussetzungKampftechnik`.
 */
export function clampCombatAttack(attack: number, tp: number): number {
  const lo = Math.max(0, Math.ceil((tp - MAX_AT_PA_DIFF) / 2));
  const hi = Math.min(Math.max(0, tp), Math.floor((tp + MAX_AT_PA_DIFF) / 2));
  if (lo > hi) return Math.max(0, Math.min(tp, attack));
  return Math.max(lo, Math.min(hi, attack));
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

function resolvedColumn(
  held: HeldModel,
  talent: CatalogItem,
  learningMethod: LearningMethod,
  currentTp?: number
): string {
  const base = resolveTalentSktColumn(held, talent, { currentTp });
  if (!isVeteranPhase(held)) return base;
  return shiftColumn(base, LEARNING_METHOD_COLUMN_SHIFT[learningMethod]);
}

function raiseCostAt(
  held: HeldModel,
  talent: CatalogItem,
  fromTp: number,
  learningMethod: LearningMethod = "none"
): number {
  const col = resolvedColumn(held, talent, learningMethod, fromTp);
  const raw = sktCost(col, fromTp + 1);
  return Math.round(raw * languageRaiseApMultiplier(held, talent));
}

/** Sum of raise costs from `from` to `to`, re-resolving column at each step. */
function apToRaiseWithModifiers(
  held: HeldModel,
  talent: CatalogItem,
  from: number,
  to: number,
  learningMethod: LearningMethod = "none"
): number {
  if (to <= from) return 0;
  let sum = 0;
  for (let lvl = from; lvl < to; lvl++) {
    sum += raiseCostAt(held, talent, lvl, learningMethod);
  }
  return sum;
}

export function talentDisplayApCost(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>,
  learningMethod: LearningMethod = "none"
): number {
  const id = String(talent.id);
  const row = talentRow(held, id);
  const col = resolvedColumn(held, talent, learningMethod, row?.tp ?? 0);
  if (!row || !isTalentActivated(held, talent, seededIds)) {
    return activationCost(held.phase, col);
  }
  const to = row.tp + 1;
  const baseline = row.baselineTp ?? 0;
  if (isVeteranPhase(held) && to <= baseline) return 0;
  return raiseCostAt(held, talent, row.tp, learningMethod);
}

export function talentAdvancementLabel(
  held: HeldModel,
  talent: CatalogItem
): string {
  const tp = talentRow(held, String(talent.id))?.tp ?? 0;
  return sktColumnLabel(resolveTalentSktColumn(held, talent, { currentTp: tp }));
}

/** Total AP spent on a talent row (activation + raises). */
export function talentRowApSpent(
  row: TalentWert,
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>
): number {
  const actCol = resolveTalentSktColumn(held, talent, { currentTp: 0 });
  let sum = apToRaiseWithModifiers(held, talent, 0, row.tp);
  if (
    !isBasicTalent(talent) &&
    !seededIds.has(row.id) &&
    row.activated !== false
  ) {
    sum += activationCost(held.phase, actCol);
  }
  return sum;
}

export function activateTalent(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>,
  learningMethod: LearningMethod = "none"
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
  const col = resolvedColumn(held, talent, learningMethod);
  const activationCostAp =
    seededIds.has(id) || isBasicTalent(talent)
      ? 0
      : activationCost(held.phase, col);
  return {
    ...held,
    talents: [
      ...held.talents,
      {
        id,
        tp: 0,
        baselineTp: isVeteranPhase(held) ? 0 : undefined,
        activated: isBasicTalent(talent) ? undefined : true,
      },
    ],
    apSpent: held.apSpent + activationCostAp,
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
  seededIds: Set<string>,
  learningMethod: LearningMethod = "none"
): HeldModel {
  const id = String(talent.id);
  if (!canEditTalentValues(held, talent, seededIds)) return held;
  const row = talentRow(held, id);
  if (!row) return held;
  const from = row.tp;
  const to = from + 1;
  const baseline = row.baselineTp ?? 0;
  let cost = 0;
  if (isVeteranPhase(held)) {
    if (to > baseline) cost = raiseCostAt(held, talent, from, learningMethod);
  } else {
    cost = raiseCostAt(held, talent, from, learningMethod);
  }
  const nextAttack =
    isCombatTalent(talent) && !isRangedCombatTalent(talent)
      ? clampCombatAttack(row.attack ?? 0, to)
      : undefined;
  return {
    ...held,
    talents: held.talents.map((t) =>
      t.id === id
        ? {
            ...t,
            tp: to,
            ...(nextAttack !== undefined ? { attack: nextAttack } : {}),
          }
        : t
    ),
    apSpent: held.apSpent + cost,
  };
}

export function lowerTalentTp(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>,
  learningMethod: LearningMethod = "none",
  minTp = 0
): HeldModel {
  const id = String(talent.id);
  const row = talentRow(held, id);
  if (!row || row.tp <= minTp) return held;
  const from = row.tp;
  const baseline = row.baselineTp ?? 0;
  let refund = 0;
  if (isVeteranPhase(held)) {
    if (from > baseline) refund = raiseCostAt(held, talent, from - 1, learningMethod);
  } else {
    refund = raiseCostAt(held, talent, from - 1, learningMethod);
  }
  const nextTp = from - 1;
  const nextAttack =
    isCombatTalent(talent) && !isRangedCombatTalent(talent)
      ? clampCombatAttack(row.attack ?? 0, nextTp)
      : Math.min(row.attack ?? 0, nextTp);
  return {
    ...held,
    talents: held.talents.map((t) =>
      t.id === id ? { ...t, tp: nextTp, attack: nextAttack } : t
    ),
    apSpent: Math.max(0, held.apSpent - refund),
  };
}

export function setTalentAttack(
  held: HeldModel,
  talent: CatalogItem,
  seededIds: Set<string>,
  attack: number,
  attributeMods?: AttributeMods
): HeldModel {
  const id = String(talent.id);
  if (!canEditTalentValues(held, talent, seededIds)) return held;
  const row = talentRow(held, id);
  if (!row) return held;
  const tp = effectiveTalentTp(held, id, row.tp, attributeMods);
  const clamped = clampCombatAttack(attack, tp);
  return {
    ...held,
    talents: held.talents.map((t) =>
      t.id === id ? { ...t, attack: clamped } : t
    ),
  };
}

export function canActivateMoreTalents(
  held: HeldModel,
  seededIds: Set<string>
): boolean {
  if (isVeteranPhase(held)) return true;
  return countNonSeededActivations(held, seededIds) < MAX_TALENT_ACTIVATIONS;
}
