/**
 * Recompute derived base values from attributes + race/culture/profession + trait mods.
 * Formulas match DSA 4.1 / Java `Basiswert`.
 *
 * Java model: Stufe = Basisstufe + getModifikation(Rasse/Kultur/Profession + traits)
 *           + Zukauf + Bonus.
 * Nexus stores package mods (incl. live trait mods) + XML Bonus together in
 * `modification`; export subtracts package mods to write XML `Bonus`.
 * Refresh must preserve the player XML Bonus (e.g. Great Meditation).
 */

import type { DerivedCode, AttributeMods, HeldModel } from "@/lib/chargen/types";
import { currentAttrValue } from "@/lib/chargen/types";
import { hasTrait } from "@/lib/chargen/rules/kosten";
import {
  FULL_SPELLCASTER_ID,
  QUARTER_SPELLCASTER_IDS,
  isSpellcaster,
} from "@/lib/chargen/rules/spellPrereqs";

const TRAIT_HIGH_VITALITY = "VorNachteil.HoheLebenskraft";
const TRAIT_LOW_VITALITY = "VorNachteil.NiedrigeLebenskraft";
const TRAIT_HIGH_RM = "VorNachteil.HoheMagieresistenz";
const TRAIT_LOW_RM = "VorNachteil.NiedrigeMagieresistenz";
const TRAIT_ASTRAL_POWER = "VorNachteil.Astralmacht";
const TRAIT_LOW_ASP = "VorNachteil.NiedrigeAstralkraft";
const TRAIT_ENDURING = "VorNachteil.Ausdauernd";
const TRAIT_SHORT_BREATH = "VorNachteil.Kurzatmig";
const TRAIT_IRON = "VorNachteil.Eisern";
const TRAIT_GLASS_BONES = "VorNachteil.Glasknochen";

function traitRating(held: HeldModel, id: string): number {
  const row = held.advantagesDisadvantages.find((t) => t.id === id);
  if (!row) return 0;
  return row.rating ?? 1;
}

/**
 * Live advantage/disadvantage mods for a derived value (Java `Basiswert.initialisieren`
 * + `Ausdauer.getModifikation`). These are part of the package portion — not XML Bonus.
 */
export function traitDerivedMod(held: HeldModel, code: string): number {
  switch (code) {
    case "VP":
      return traitRating(held, TRAIT_HIGH_VITALITY) - traitRating(held, TRAIT_LOW_VITALITY);
    case "EP":
      return (
        2 * traitRating(held, TRAIT_ENDURING) - 2 * traitRating(held, TRAIT_SHORT_BREATH)
      );
    case "RM":
      return (
        traitRating(held, TRAIT_HIGH_RM) -
        traitRating(held, TRAIT_LOW_RM) +
        (hasTrait(held, FULL_SPELLCASTER_ID) ? 2 : 0)
      );
    case "ASP": {
      let n =
        traitRating(held, TRAIT_ASTRAL_POWER) - traitRating(held, TRAIT_LOW_ASP);
      if (hasTrait(held, FULL_SPELLCASTER_ID)) n += 12;
      if (QUARTER_SPELLCASTER_IDS.some((id) => hasTrait(held, id))) n -= 6;
      return n;
    }
    case "WT":
      return (
        (hasTrait(held, TRAIT_IRON) ? 2 : 0) -
        (hasTrait(held, TRAIT_GLASS_BONES) ? 2 : 0)
      );
    default:
      return 0;
  }
}

function setDerivedBasePreservingPlayerBonus(
  held: HeldModel,
  code: DerivedCode,
  base: number,
  packageMod: number
) {
  const row = held.derived.find((d) => d.code === code);
  const bausteinOnly = packageMod - traitDerivedMod(held, code);
  if (row) {
    let playerBonus: number;
    if (row.xmlBonusOnly) {
      // Fresh DCG import: modification is pure XML Bonus.
      playerBonus = row.modification;
      row.xmlBonusOnly = false;
    } else if (row.packageBaseline === undefined) {
      // DB / JSON load: modification already includes current package.
      playerBonus = row.modification - packageMod;
    } else {
      playerBonus = row.modification - row.packageBaseline;
      // Recover sticky packageBaseline: 0 (old import sentinel) — modification
      // already holds the folded package (or race-only baustein).
      if (row.packageBaseline === 0) {
        if (
          playerBonus === packageMod ||
          (playerBonus === bausteinOnly && bausteinOnly !== 0)
        ) {
          playerBonus = 0;
        }
      } else if (
        // Completed double-count (VP 43 / EP 39): race baustein kept as Bonus.
        row.packageBaseline === packageMod &&
        playerBonus === bausteinOnly &&
        bausteinOnly !== 0
      ) {
        playerBonus = 0;
      }
    }
    row.base = base;
    row.modification = packageMod + playerBonus;
    row.packageBaseline = packageMod;
  } else {
    held.derived.push({
      code,
      base,
      modification: packageMod,
      purchased: 0,
      packageBaseline: packageMod,
    });
  }
}

export function recomputeDerived(
  held: HeldModel,
  mods: {
    race?: Record<string, number>;
    culture?: Record<string, number>;
    profession?: Record<string, number>;
    attributeMods?: AttributeMods;
  } = {}
): void {
  const attrMods: AttributeMods = mods.attributeMods ?? {
    race: mods.race,
    culture: mods.culture,
    profession: mods.profession,
  };
  const co = currentAttrValue(held, "CO", attrMods);
  const cl = currentAttrValue(held, "CL", attrMods);
  const inn = currentAttrValue(held, "IN", attrMods);
  const ch = currentAttrValue(held, "CH", attrMods);
  const de = currentAttrValue(held, "DE", attrMods);
  const ag = currentAttrValue(held, "AG", attrMods);
  const cn = currentAttrValue(held, "CN", attrMods);
  const st = currentAttrValue(held, "ST", attrMods);

  const merge = (code: string) =>
    (mods.race?.[code] ?? 0) +
    (mods.culture?.[code] ?? 0) +
    (mods.profession?.[code] ?? 0) +
    traitDerivedMod(held, code);

  // VP = round((CN+CN+ST)/2) + package/trait mods
  setDerivedBasePreservingPlayerBonus(
    held,
    "VP",
    Math.round((cn + cn + st) / 2),
    merge("VP")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "EP",
    Math.round((co + cn + ag) / 2),
    merge("EP")
  );
  // RM uses CN (not IN) — Java Formel(MU, KL, KO)
  setDerivedBasePreservingPlayerBonus(
    held,
    "RM",
    Math.round((co + cl + cn) / 5),
    merge("RM")
  );
  // ASP base is 0 unless spellcaster (Java Astralenergie.getBasisstufe)
  setDerivedBasePreservingPlayerBonus(
    held,
    "ASP",
    isSpellcaster(held) ? Math.round((co + inn + ch) / 2) : 0,
    merge("ASP")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "WT",
    Math.round(cn / 2),
    merge("WT")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "baseAT",
    Math.round((co + ag + st) / 5),
    merge("baseAT")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "basePA",
    Math.round((inn + ag + st) / 5),
    merge("basePA")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "baseBRV",
    Math.round((inn + de + st) / 5),
    merge("baseBRV")
  );
  // INI uses CO twice — Java Formel(MU, MU, IN, GE)
  setDerivedBasePreservingPlayerBonus(
    held,
    "baseINI",
    Math.round((co + co + inn + ag) / 5),
    merge("baseINI")
  );
  setDerivedBasePreservingPlayerBonus(held, "GS", 8, merge("GS"));
}
