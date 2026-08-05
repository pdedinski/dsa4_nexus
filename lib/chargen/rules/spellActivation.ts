/**
 * Spell activation during creation — mirrors Java `PanelZauberListe` / `Held` spell I/O.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel, SpellWert } from "@/lib/chargen/types";
import { apToRaise, sktActivationCost } from "@/lib/chargen/rules/kosten";
import { resolveSpellSktColumn } from "@/lib/chargen/rules/sktColumn";
import { isSpellSelectable } from "@/lib/chargen/rules/spellPrereqs";

export const MAX_SPELL_ACTIVATIONS = 7;

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

export function spellRowApSpent(
  row: SpellWert,
  held: HeldModel,
  spell: CatalogItem
): number {
  const col = resolveSpellSktColumn(held, spell);
  let sum = apToRaise(col, 0, row.sp);
  if (row.activated !== false) {
    sum += sktActivationCost(col);
  }
  return sum;
}

export function activateSpell(
  held: HeldModel,
  spell: CatalogItem
): HeldModel {
  const id = String(spell.id);
  if (!isSpellSelectable(held, spell)) return held;
  if (isSpellOnHeld(held, id)) return held;
  const col = resolveSpellSktColumn(held, spell);
  const activationCost = sktActivationCost(col);
  return {
    ...held,
    spells: [...held.spells, { id, sp: 0 }],
    apSpent: held.apSpent + activationCost,
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

export function raiseSpellSp(held: HeldModel, spell: CatalogItem): HeldModel {
  const id = String(spell.id);
  const row = spellRow(held, id);
  if (!row) return held;
  const col = resolveSpellSktColumn(held, spell);
  const from = row.sp;
  const cost = apToRaise(col, from, from + 1);
  return {
    ...held,
    spells: held.spells.map((s) =>
      s.id === id ? { ...s, sp: from + 1 } : s
    ),
    apSpent: held.apSpent + cost,
  };
}

export function lowerSpellSp(held: HeldModel, spell: CatalogItem): HeldModel {
  const id = String(spell.id);
  const row = spellRow(held, id);
  if (!row) return held;
  if (row.sp <= 0) {
    return {
      ...held,
      spells: held.spells.filter((s) => s.id !== id),
    };
  }
  const col = resolveSpellSktColumn(held, spell);
  const from = row.sp;
  const cost = apToRaise(col, from - 1, from);
  return {
    ...held,
    spells: held.spells.map((s) =>
      s.id === id ? { ...s, sp: from - 1 } : s
    ),
    apSpent: Math.max(0, held.apSpent - cost),
  };
}

/** Add spell or raise SP — matches wizard + button behavior. */
export function addOrRaiseSpell(
  held: HeldModel,
  spell: CatalogItem
): HeldModel {
  const id = String(spell.id);
  if (!isSpellOnHeld(held, id)) {
    return activateSpell(held, spell);
  }
  return raiseSpellSp(held, spell);
}

/** Lower SP or remove spell when SP would drop below 0. */
export function lowerOrRemoveSpell(
  held: HeldModel,
  spell: CatalogItem
): HeldModel {
  return lowerSpellSp(held, spell);
}
