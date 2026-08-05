/**
 * GP / AP budgets during creation — mirrors `ErschaffungManager`.
 * GP start = 110; AP start = 20 × (CL + IN).
 */

import type { HeldModel } from "@/lib/chargen/types";
import { GP_START, currentAttrValue, type AttributeMods } from "@/lib/chargen/types";
import { attributeSumBase } from "@/lib/chargen/rules/kosten";

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
    magicApSpent?: number;
  } = {}
): BudgetSnapshot {
  const gpRace = opts.raceGp ?? 0;
  const gpCulture = opts.cultureGp ?? 0;
  const gpProfession = opts.professionGp ?? 0;
  const gpAttributes = attributeSumBase(held);
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
  const magicApBudget = Math.floor((apStart + educatedApSaved) / 2);
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
    apRemaining: apStart - apSpent,
    educatedApSaved,
    educatedApRemaining: educatedApSaved,
    magicApBudget,
    magicApSpent,
    magicApRemaining: magicApBudget - magicApSpent,
  };
}
