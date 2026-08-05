/**
 * SKT column resolution with Begabung / Unfähigkeit / Elven Worldview modifiers.
 * Mirrors Java `talente/kosten/Kosten*.java` and `zauber/kosten/KostenStandard.java`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel } from "@/lib/chargen/types";
import {
  columnIndex,
  defaultSpellColumn,
  hasTrait,
} from "@/lib/chargen/rules/kosten";

const SKT_COLUMN_LETTERS = ["A*", "A", "B", "C", "D", "E", "F", "G", "H"];

const BEGABUNG_TALENT = "VorNachteil.BegabungFuerTalent";
const BEGABUNG_GRUPPE = "VorNachteil.BegabungFuerTalentgruppe";
const UNFAEHIGKEIT_TALENT = "VorNachteil.UnfaehigkeitFuerTalent";
const UNFAEHIGKEIT_GRUPPE = "VorNachteil.UnfaehigkeitFuerTalentgruppe";
const ELFISCHE_WELTSICHT = "VorNachteil.ElfischeWeltsicht";
const REPR_MAGIER = "Sonderfertigkeit.Repraesentation";

export function indexToColumn(idx: number): string {
  const clamped = Math.max(0, Math.min(8, idx));
  return SKT_COLUMN_LETTERS[clamped];
}

export function baseTalentSktColumn(talent: CatalogItem): string {
  const col = talent.skt_column;
  if (col == null) return "B";
  if (typeof col === "string") return col;
  return indexToColumn(Number(col));
}

function hasTraitForTalent(held: HeldModel, traitId: string, talentId: string): boolean {
  return held.advantagesDisadvantages.some(
    (t) => t.id === traitId && t.variant === talentId
  );
}

function hasTraitForGroup(held: HeldModel, traitId: string, group: string): boolean {
  return held.advantagesDisadvantages.some(
    (t) => t.id === traitId && t.variant === group
  );
}

export function hasSpellRepresentation(held: HeldModel, rep: string): boolean {
  const normalized = rep.toUpperCase();
  return held.specialAbilities.some((s) => {
    if (s.id !== REPR_MAGIER) return false;
    const v = (s.variant || "").toUpperCase();
    if (normalized === "MAGIER") {
      return v.includes("MAGIER") || v === "" || v === "REPRAESENTATION.MAGIER";
    }
    if (normalized === "ELFEN") {
      return v.includes("ELFEN") || v === "REPRAESENTATION.ELFEN";
    }
    return v.includes(normalized);
  });
}

export function resolveTalentSktColumn(
  held: HeldModel,
  talent: CatalogItem
): string {
  let idx = columnIndex(baseTalentSktColumn(talent));
  const talentId = String(talent.id);
  const group = String(talent.group || "");

  if (hasTraitForTalent(held, UNFAEHIGKEIT_TALENT, talentId)) idx += 1;
  if (group && hasTraitForGroup(held, UNFAEHIGKEIT_GRUPPE, group)) idx += 1;
  if (hasTraitForTalent(held, BEGABUNG_TALENT, talentId)) idx -= 1;
  if (group && hasTraitForGroup(held, BEGABUNG_GRUPPE, group)) idx -= 1;
  if (
    hasTrait(held, ELFISCHE_WELTSICHT) &&
    !held.leadTalents.includes(talentId) &&
    group !== "gifts"
  ) {
    idx += 1;
  }
  return indexToColumn(idx);
}

export function resolveSpellSktColumn(
  held: HeldModel,
  spell: CatalogItem
): string {
  let idx = columnIndex(defaultSpellColumn(Number(spell.complexity ?? 2)));
  const reps = (spell.representations as string[]) || [];
  if (reps.length === 1 && !hasSpellRepresentation(held, reps[0])) {
    idx += 2;
  }
  const spellId = String(spell.id);
  if (held.leadSpells.includes(spellId)) {
    idx -= 1;
  } else if (hasTrait(held, ELFISCHE_WELTSICHT)) {
    idx += 1;
  }
  return indexToColumn(idx);
}
