/**
 * SKT column resolution with Begabung / Unfähigkeit / Elven Worldview /
 * Akademische Ausbildung / Schlangenmensch / Gelehrter modifiers.
 * Mirrors Java `talente/kosten/Kosten*.java` and `zauber/kosten/KostenStandard.java`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel } from "@/lib/chargen/types";
import { isVeteranPhase } from "@/lib/chargen/types";
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
const GELEHRTER = "VorNachteil.AkademischeAusbildungGelehrter";
const KRIEGER_AUSBILDUNG = "VorNachteil.AkademischeAusbildungKrieger";
const SCHLANGENMENSCH = "VorNachteil.Schlangenmensch";
const REPR_MAGIER = "Sonderfertigkeit.Repraesentation";

/**
 * Language family for foreign-language SKT surcharge
 * (Java `Sprachfamilie` via `Talent.initialisiereSprache`).
 */
const LANGUAGE_FAMILY: Record<string, string> = {
  "Talent.Alaani": "Tulamidya",
  "Talent.Asdharia": "Asdharia",
  "Talent.Atak": "Atak",
  "Talent.Bosparano": "Garethi",
  "Talent.Fuechsisch": "Fuechsisch",
  "Talent.Garethi": "Garethi",
  "Talent.Goblinisch": "Goblinisch",
  "Talent.Isdira": "Isdira",
  "Talent.Mohisch": "Mohisch",
  "Talent.Nujuka": "Nujuka",
  "Talent.Oloarkh": "Oloarkh",
  "Talent.Ologhaijan": "Ologhaijan",
  "Talent.Rogolan": "Rogolan",
  "Talent.Rssahh": "Rssahh",
  "Talent.Thorwalsch": "Thorwalsch",
  "Talent.Tulamidya": "Tulamidya",
  "Talent.UrTulamidya": "Tulamidya",
  "Talent.Zhayad": "Zhayad",
};

/** True when raising this language costs the post-creation foreign surcharge. */
export function isForeignLanguage(held: HeldModel, talentId: string): boolean {
  if (talentId === held.secondLanguage) return false;
  const mother = held.motherTongue;
  if (!mother) return talentId !== held.secondLanguage;
  const motherFamily = LANGUAGE_FAMILY[mother];
  const talentFamily = LANGUAGE_FAMILY[talentId];
  if (motherFamily && talentFamily) return motherFamily !== talentFamily;
  // Unknown IDs: fall back to ID inequality (legacy behaviour)
  return talentId !== mother;
}

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

function hasCombatSubgroupTrait(
  held: HeldModel,
  traitId: string,
  talent: CatalogItem
): boolean {
  const ranged = talent.ranged === true;
  if (ranged && hasTraitForGroup(held, traitId, "fernkampf")) return true;
  if (!ranged && hasTraitForGroup(held, traitId, "nahkampf")) return true;
  return false;
}

export function hasSpellRepresentation(held: HeldModel, rep: string): boolean {
  const normalized = rep.toUpperCase();
  return held.specialAbilities.some((s) => {
    if (s.id !== REPR_MAGIER) return false;
    const v = (s.variant || "").toUpperCase();
    if (normalized === "MAGIER") {
      return v.includes("MAGIER");
    }
    if (normalized === "ELFEN") {
      return v.includes("ELFEN") || v === "REPRAESENTATION.ELFEN";
    }
    return v.includes(normalized);
  });
}

export type ResolveTalentColumnOpts = {
  /** Current TP (Java `i` in getSteigerungsspalte). Defaults to held row TP or 0. */
  currentTp?: number;
};

/**
 * Resolve effective SKT column for a talent raise/activation.
 * Pass `currentTp` for TP-threshold rules (Gelehrter / Krieger < 10).
 */
export function resolveTalentSktColumn(
  held: HeldModel,
  talent: CatalogItem,
  opts: ResolveTalentColumnOpts = {}
): string {
  let idx = columnIndex(baseTalentSktColumn(talent));
  const talentId = String(talent.id);
  const group = String(talent.group || "");
  const currentTp =
    opts.currentTp ??
    held.talents.find((t) => t.id === talentId)?.tp ??
    0;
  const creating = !isVeteranPhase(held);
  const below10 = currentTp < 10;

  // Unfähigkeit (talent + group) — base Kosten
  if (hasTraitForTalent(held, UNFAEHIGKEIT_TALENT, talentId)) idx += 1;
  if (group && hasTraitForGroup(held, UNFAEHIGKEIT_GRUPPE, group)) idx += 1;

  if (group === "combat") {
    // KostenKampftechnik: Fernkampf/Nahkampf Unfähigkeit
    if (hasCombatSubgroupTrait(held, UNFAEHIGKEIT_GRUPPE, talent)) idx += 1;

    let begabungApplied = false;
    if (creating && below10 && hasTrait(held, KRIEGER_AUSBILDUNG)) {
      // Akademische Ausbildung (Krieger): −2 while creating and TP < 10
      // (replaces Begabung for this raise)
      idx -= 2;
      begabungApplied = true;
    } else {
      if (hasTraitForTalent(held, BEGABUNG_TALENT, talentId)) {
        idx -= 1;
        begabungApplied = true;
      }
      if (
        hasTraitForGroup(held, BEGABUNG_GRUPPE, "combat") ||
        hasCombatSubgroupTrait(held, BEGABUNG_GRUPPE, talent)
      ) {
        idx -= 1;
        begabungApplied = true;
      }
    }
    if (
      !begabungApplied &&
      talentId === "Talent.Ringen" &&
      hasTrait(held, SCHLANGENMENSCH)
    ) {
      idx -= 1;
    }
  } else if (group === "languages") {
    // KostenSprache: +1 after creation when language family ≠ mother tongue
    // (second language of same family is exempt even if ID differs)
    if (isVeteranPhase(held) && isForeignLanguage(held, talentId)) {
      idx += 1;
    }
    // Gelehrter −1 while creating and TP < 10
    const gelehrterBonus =
      creating && below10 && hasTrait(held, GELEHRTER);
    const hasBegTalent = hasTraitForTalent(held, BEGABUNG_TALENT, talentId);
    const hasBegGroup = hasTraitForGroup(held, BEGABUNG_GRUPPE, "languages");
    if (hasBegTalent && hasBegGroup) {
      idx -= 2;
    } else if (hasBegTalent || hasBegGroup || gelehrterBonus) {
      idx -= 1;
    }
  } else if (group === "scripts" || group === "knowledge") {
    // KostenSchriftWissen
    const gelehrterBonus =
      creating && below10 && hasTrait(held, GELEHRTER);
    const hasBegTalent = hasTraitForTalent(held, BEGABUNG_TALENT, talentId);
    const hasBegGroup = group
      ? hasTraitForGroup(held, BEGABUNG_GRUPPE, group)
      : false;
    if (hasBegTalent && hasBegGroup) {
      idx -= 2;
    } else if (hasBegTalent || hasBegGroup || gelehrterBonus) {
      idx -= 1;
    }
  } else {
    // KostenStandard
    if (hasTraitForTalent(held, BEGABUNG_TALENT, talentId)) idx -= 1;
    if (group && hasTraitForGroup(held, BEGABUNG_GRUPPE, group)) idx -= 1;
  }

  // Elfische Weltsicht — not for Gaben / lead talents
  if (
    hasTrait(held, ELFISCHE_WELTSICHT) &&
    !held.leadTalents.includes(talentId) &&
    group !== "gifts"
  ) {
    idx += 1;
  }

  return indexToColumn(idx);
}

/**
 * Good Memory multiplies language raise AP by 0.75 (Java KostenSprache).
 * Not a column shift — applied after SKT lookup.
 */
export function languageRaiseApMultiplier(held: HeldModel, talent: CatalogItem): number {
  if (String(talent.group || "") !== "languages") return 1;
  if (hasTrait(held, "VorNachteil.GutesGedaechtnis")) return 0.75;
  return 1;
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
  if (held.leadSpells.includes(spellId) || held.houseSpells.includes(spellId)) {
    idx -= 1;
  } else if (hasTrait(held, ELFISCHE_WELTSICHT)) {
    idx += 1;
  }
  return indexToColumn(idx);
}
