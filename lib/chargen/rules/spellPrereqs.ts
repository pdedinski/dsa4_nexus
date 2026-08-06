/**
 * Spell selection prerequisites — spellcaster advantage and representation.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel } from "@/lib/chargen/types";
import { hasTrait } from "@/lib/chargen/rules/kosten";
import type { Konflikt } from "@/lib/chargen/rules/voraussetzungen";

const REPR_MAGIER = "Sonderfertigkeit.Repraesentation";
const REPR_ELFEN = "Sonderfertigkeit.Repraesentation"; // variant distinguishes

export const FULL_SPELLCASTER_ID = "VorNachteil.Vollzauberer";
export const QUARTER_SPELLCASTER_IDS = [
  "VorNachteil.Viertelzauberer",
  "VorNachteil.ViertelzaubererUnbewusst",
] as const;

/** Java `Held.istZauberer()` — any spellcasting trait. */
export function isSpellcaster(held: HeldModel): boolean {
  return (
    hasTrait(held, FULL_SPELLCASTER_ID) ||
    QUARTER_SPELLCASTER_IDS.some((id) => hasTrait(held, id))
  );
}

/** Standard spells require full Spellcaster (Vollzauberer). */
export function hasFullSpellcaster(held: HeldModel): boolean {
  return hasTrait(held, FULL_SPELLCASTER_ID);
}

export function spellcasterBlocked(held: HeldModel): boolean {
  return !hasFullSpellcaster(held);
}

export function spellRepresentationBlocked(
  held: HeldModel,
  spell: CatalogItem
): boolean {
  const reps = (spell.representations as string[]) || [];
  if (reps.length !== 1) return false;
  const rep = reps[0];
  if (rep === "Magier" || rep === "MAGIER") {
    return !held.specialAbilities.some((s) => {
      if (s.id !== REPR_MAGIER) return false;
      const v = (s.variant || "").toUpperCase();
      return v.includes("MAGIER");
    });
  }
  if (rep === "Elfen" || rep === "ELFEN") {
    return !held.specialAbilities.some((s) => {
      if (s.id !== REPR_ELFEN) return false;
      const v = (s.variant || "").toUpperCase();
      return v.includes("ELFEN");
    });
  }
  return false;
}

export function checkSpellRepresentation(
  held: HeldModel,
  spells: CatalogItem[],
  resolveName?: (id: string) => string
): Konflikt[] {
  const out: Konflikt[] = [];
  for (const sp of held.spells) {
    const meta = spells.find((s) => s.id === sp.id);
    if (!meta) continue;
    if (spellRepresentationBlocked(held, meta)) {
      out.push({
        code: `spell_repr:${sp.id}`,
        message: `${resolveName?.(sp.id) || sp.id}: cannot be selected at game start without matching Representation.`,
        severity: "error",
        section: "spells",
      });
    }
  }
  return out;
}

export function spellBlockReason(
  held: HeldModel,
  spell: CatalogItem
): string | null {
  if (spellcasterBlocked(held)) {
    return "Needs Advantage Spellcaster.";
  }
  if (spellRepresentationBlocked(held, spell)) {
    return "Cannot be selected at game start without matching Representation.";
  }
  return null;
}

export function checkSpellcaster(
  held: HeldModel,
  spells: CatalogItem[],
  resolveName?: (id: string) => string
): Konflikt[] {
  if (hasFullSpellcaster(held) || held.spells.length === 0) return [];
  const out: Konflikt[] = [];
  for (const sp of held.spells) {
    const meta = spells.find((s) => s.id === sp.id);
    if (!meta) continue;
    out.push({
      code: `spell_no_spellcaster:${sp.id}`,
      message: `${resolveName?.(sp.id) || sp.id}: requires the Spellcaster advantage.`,
      severity: "error",
      section: "spells",
    });
  }
  return out;
}

export function isSpellSelectable(
  held: HeldModel,
  spell: CatalogItem
): boolean {
  return spellBlockReason(held, spell) === null;
}
