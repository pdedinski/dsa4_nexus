/**
 * GP / AP budgets during creation — mirrors `ErschaffungManager`.
 * GP start = 110; AP start = 20 × (CL + IN).
 *
 * Attribute GP (Java `getGpGuthaben`): each creation base point costs 1 GP
 * (attributes start at 0). Profession SO minimum is refunded (free).
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttrCodeWithSo, HeldModel } from "@/lib/chargen/types";
import {
  GP_START,
  currentAttrValue,
  type AttributeMods,
} from "@/lib/chargen/types";
import { hasTrait } from "@/lib/chargen/rules/kosten";

export interface BudgetSnapshot {
  gpStart: number;
  gpRace: number;
  gpCulture: number;
  gpProfession: number;
  gpAttributes: number;
  gpTraits: number;
  gpSpecialAbilities: number;
  gpRemaining: number;
  apStart: number;
  apSpent: number;
  apRemaining: number;
  /** Educated (Gebildet) AP savings pool — Java sub-budget. */
  educatedApSaved?: number;
  educatedApRemaining?: number;
  /** Magic AP sub-budget (spells + magical SF). */
  magicApBudget?: number;
  magicApSpent?: number;
  magicApRemaining?: number;
}

export function computeApStart(
  held: HeldModel,
  attributeMods?: AttributeMods
): number {
  const cl = currentAttrValue(held, "CL", attributeMods);
  const inn = currentAttrValue(held, "IN", attributeMods);
  return 20 * (cl + inn);
}

/**
 * Profession GP cost — mirrors Java `KostenFest` / `KostenRasse`.
 * Uses `gp_cost_by_race[raceId]` when present, else `gp_cost`.
 */
export function resolveProfessionGpCost(
  profession: CatalogItem | null | undefined,
  raceId?: string | null
): number {
  if (!profession) return 0;
  const byRace = profession.gp_cost_by_race as
    | Record<string, number>
    | undefined;
  if (raceId && byRace && byRace[raceId] != null) {
    return Number(byRace[raceId]);
  }
  return Number(profession.gp_cost ?? 0);
}

/** Profession SO minimum used as free GP refund (Java LEERE_PROFESSION = 0). */
export function professionSoMinimum(
  profession: CatalogItem | null | undefined,
  held?: HeldModel
): number {
  let min = Number(profession?.so_min ?? 0);
  if (
    held &&
    hasTrait(held, "VorNachteil.AkademischeAusbildungKrieger") &&
    min > 0
  ) {
    min -= 1;
  }
  return Math.max(0, min);
}

/**
 * GP spent on attribute creation bases — mirrors Java:
 * sum(all bases incl. SO) − free profession SO minimum (up to current SO).
 */
export function attributeGpCost(
  held: HeldModel,
  profession?: CatalogItem | null
): number {
  let sum = 0;
  let soBase = 0;
  for (const a of held.attributes) {
    sum += a.base;
    if (a.code === "SO") soBase = a.base;
  }
  const soMin = professionSoMinimum(profession, held);
  const soRefund = soBase >= soMin ? soMin : soBase;
  return sum - soRefund;
}

/** Raw sum of non-SO creation bases (legacy helper). */
export function attributeSumBase(held: HeldModel): number {
  return held.attributes
    .filter((a) => a.code !== "SO")
    .reduce((sum, a) => sum + a.base, 0);
}

const DEFAULT_ATTR_MIN: Record<AttrCodeWithSo, number> = {
  CO: 8,
  CL: 8,
  IN: 8,
  CH: 8,
  DE: 8,
  AG: 8,
  CN: 8,
  ST: 8,
  SO: 1,
};

/**
 * Java `ErschaffungManager.einstellenMindeststufe` — set creation bases to
 * race/profession minima (default 8 / SO ≥ 1) when leaving foundation.
 */
export function applyCreationAttributeMinimums(
  held: HeldModel,
  race?: CatalogItem | null,
  profession?: CatalogItem | null,
  culture?: CatalogItem | null
): HeldModel {
  const raceMins = (race?.attribute_minimums as Record<string, number>) || {};
  const profMins =
    (profession?.attribute_minimums as Record<string, number>) || {};
  const soFloor = Math.max(
    DEFAULT_ATTR_MIN.SO,
    professionSoMinimum(profession, held)
  );

  return {
    ...held,
    attributes: held.attributes.map((a) => {
      let min = a.code === "SO" ? soFloor : DEFAULT_ATTR_MIN[a.code] ?? 8;
      if (raceMins[a.code] != null) {
        min = Math.max(min, Number(raceMins[a.code]));
      }
      if (profMins[a.code] != null) {
        min = Math.max(min, Number(profMins[a.code]));
      }
      // Race/culture/profession modifiers are free (Java subtracts mod from required base)
      const raceMod =
        Number(
          ((race?.attribute_modifiers as Record<string, number>) || {})[a.code]
        ) || 0;
      const cultureMod =
        Number(
          ((culture?.attribute_modifiers as Record<string, number>) || {})[
            a.code
          ]
        ) || 0;
      const profMod =
        Number(
          ((profession?.attribute_modifiers as Record<string, number>) || {})[
            a.code
          ]
        ) || 0;
      const target = Math.max(0, min - raceMod - cultureMod - profMod);
      return { ...a, base: Math.max(a.base, target) };
    }),
  };
}

export function computeBudget(
  held: HeldModel,
  opts: {
    raceGp?: number;
    cultureGp?: number;
    professionGp?: number;
    traitGpNet?: number;
    specialAbilityGp?: number;
    attributeMods?: AttributeMods;
    educatedApSaved?: number;
    /** How much of the Educated pool is currently applied (Java Einsparung). */
    educatedApApplied?: number;
    magicApSpent?: number;
    profession?: CatalogItem | null;
  } = {}
): BudgetSnapshot {
  const gpRace = opts.raceGp ?? 0;
  const gpCulture = opts.cultureGp ?? 0;
  const gpProfession = opts.professionGp ?? 0;
  const gpAttributes = attributeGpCost(held, opts.profession);
  const gpTraits = opts.traitGpNet ?? 0;
  const gpSpecialAbilities = opts.specialAbilityGp ?? 0;
  const gpRemaining =
    GP_START -
    gpRace -
    gpCulture -
    gpProfession -
    gpAttributes -
    gpTraits -
    gpSpecialAbilities;

  const apStart = computeApStart(held, opts.attributeMods);
  const apSpent = held.apSpent;
  const educatedApSaved = opts.educatedApSaved ?? 0;
  const educatedApApplied = Math.min(
    educatedApSaved,
    Math.max(0, opts.educatedApApplied ?? 0)
  );
  const magicApBudget = Math.round(apStart / 2) + Math.round(educatedApSaved / 2);
  const magicApSpent = opts.magicApSpent ?? 0;
  return {
    gpStart: GP_START,
    gpRace,
    gpCulture,
    gpProfession,
    gpAttributes,
    gpTraits,
    gpSpecialAbilities,
    gpRemaining,
    apStart,
    apSpent,
    // Java getApGuthaben adds Gebildet Einsparung back onto the remaining pool
    apRemaining: apStart - apSpent + educatedApApplied,
    educatedApSaved,
    educatedApRemaining: educatedApSaved - educatedApApplied,
    magicApBudget,
    magicApSpent,
    magicApRemaining: magicApBudget - magicApSpent,
  };
}
