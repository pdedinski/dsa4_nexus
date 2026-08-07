/**
 * Spell activation during creation — mirrors Java `PanelZauberListe` / `Held` spell I/O.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel, LearningMethod, SpellWert } from "@/lib/chargen/types";
import { isVeteranPhase, LEARNING_METHOD_COLUMN_SHIFT } from "@/lib/chargen/types";
import {
  activationCost,
  apToRaise,
  shiftColumn,
  sktColumnLabel,
  sktCost,
} from "@/lib/chargen/rules/kosten";
import { resolveSpellSktColumn } from "@/lib/chargen/rules/sktColumn";
import { isSpellSelectable } from "@/lib/chargen/rules/spellPrereqs";

export const MAX_SPELL_ACTIVATIONS = 7;

/**
 * Java `Zaubergruppe.BEGABUNG` aptitude stubs share English names with real
 * spells but are not castable entries for the Spells AP step.
 */
export function isCastableSpell(spell: CatalogItem): boolean {
  const id = String(spell.id);
  if (id.endsWith(".Begabung")) return false;
  const group = String(spell.group || "spells");
  return group === "spells" || group === "";
}

export function spellRow(
  held: HeldModel,
  spellId: string
): SpellWert | undefined {
  return held.spells.find((s) => s.id === spellId);
}

export function isSpellOnHeld(held: HeldModel, spellId: string): boolean {
  return held.spells.some((s) => s.id === spellId);
}

export function countSpellActivations(held: HeldModel): number {
  return held.spells.length;
}

export function spellAdvancementLabel(
  held: HeldModel,
  spell: CatalogItem
): string {
  return sktColumnLabel(resolveSpellSktColumn(held, spell));
}

/** Row SE replaces session method (no stack if session is already special_experience). */
export function effectiveSpellLearningMethod(
  rowSpecialExperience: boolean | undefined,
  session: LearningMethod
): LearningMethod {
  return rowSpecialExperience ? "special_experience" : session;
}

function resolvedColumn(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod
): string {
  const base = resolveSpellSktColumn(held, spell);
  if (!isVeteranPhase(held)) return base;
  return shiftColumn(base, LEARNING_METHOD_COLUMN_SHIFT[learningMethod]);
}

export function spellDisplayApCost(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod = "none"
): number {
  const id = String(spell.id);
  const row = spellRow(held, id);
  const raiseMethod = effectiveSpellLearningMethod(
    row?.specialExperience,
    learningMethod
  );
  const col = resolvedColumn(
    held,
    spell,
    row ? raiseMethod : learningMethod
  );
  if (!row) {
    return activationCost(held.phase, col);
  }
  const to = row.sp + 1;
  const baseline = row.baselineSp ?? 0;
  if (isVeteranPhase(held) && to <= baseline) return 0;
  if (isVeteranPhase(held)) {
    return sktCost(col, to);
  }
  return apToRaise(col, row.sp, to);
}

export function spellRowApSpent(
  row: SpellWert,
  held: HeldModel,
  spell: CatalogItem
): number {
  const col = resolveSpellSktColumn(held, spell);
  let sum = apToRaise(col, 0, row.sp);
  if (row.activated !== false) {
    sum += activationCost(held.phase, col);
  }
  return sum;
}

export function activateSpell(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod = "none"
): HeldModel {
  const id = String(spell.id);
  if (!isSpellSelectable(held, spell)) return held;
  if (isSpellOnHeld(held, id)) return held;
  const col = resolvedColumn(held, spell, learningMethod);
  const activationCostAp = activationCost(held.phase, col);
  return {
    ...held,
    spells: [
      ...held.spells,
      {
        id,
        sp: 0,
        baselineSp: isVeteranPhase(held) ? 0 : undefined,
      },
    ],
    apSpent: held.apSpent + activationCostAp,
  };
}

export function deactivateSpell(
  held: HeldModel,
  spell: CatalogItem
): HeldModel {
  const id = String(spell.id);
  const row = spellRow(held, id);
  if (!row) return held;
  const refund = spellRowApSpent(row, held, spell);
  return {
    ...held,
    spells: held.spells.filter((s) => s.id !== id),
    apSpent: Math.max(0, held.apSpent - refund),
  };
}

export function raiseSpellSp(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod = "none"
): HeldModel {
  const id = String(spell.id);
  const row = spellRow(held, id);
  if (!row) return held;
  const raiseMethod = effectiveSpellLearningMethod(
    row.specialExperience,
    learningMethod
  );
  const col = resolvedColumn(held, spell, raiseMethod);
  const from = row.sp;
  const to = from + 1;
  const baseline = row.baselineSp ?? 0;
  let cost = 0;
  if (isVeteranPhase(held)) {
    if (to > baseline) cost = sktCost(col, to);
  } else {
    cost = apToRaise(col, from, to);
  }
  const clearSe = !!row.specialExperience;
  return {
    ...held,
    spells: held.spells.map((s) =>
      s.id === id
        ? {
            ...s,
            sp: to,
            ...(clearSe ? { specialExperience: false } : {}),
          }
        : s
    ),
    apSpent: held.apSpent + cost,
  };
}

export function lowerSpellSp(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod = "none"
): HeldModel {
  const id = String(spell.id);
  const row = spellRow(held, id);
  if (!row) return held;
  if (row.sp <= 0) {
    return {
      ...held,
      spells: held.spells.filter((s) => s.id !== id),
    };
  }
  const col = resolvedColumn(held, spell, learningMethod);
  const from = row.sp;
  const baseline = row.baselineSp ?? 0;
  let refund = 0;
  if (isVeteranPhase(held)) {
    if (from > baseline) refund = sktCost(col, from);
  } else {
    refund = apToRaise(col, from - 1, from);
  }
  return {
    ...held,
    spells: held.spells.map((s) =>
      s.id === id ? { ...s, sp: from - 1 } : s
    ),
    apSpent: Math.max(0, held.apSpent - refund),
  };
}

/** Add spell or raise SP — matches wizard + button behavior. */
export function addOrRaiseSpell(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod = "none"
): HeldModel {
  const id = String(spell.id);
  if (!isSpellOnHeld(held, id)) {
    return activateSpell(held, spell, learningMethod);
  }
  return raiseSpellSp(held, spell, learningMethod);
}

/** Lower SP or remove spell when SP would drop below 0. */
export function lowerOrRemoveSpell(
  held: HeldModel,
  spell: CatalogItem,
  learningMethod: LearningMethod = "none"
): HeldModel {
  return lowerSpellSp(held, spell, learningMethod);
}

export function canActivateMoreSpells(held: HeldModel): boolean {
  if (isVeteranPhase(held)) return true;
  return countSpellActivations(held) < MAX_SPELL_ACTIVATIONS;
}
