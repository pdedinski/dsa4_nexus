/**
 * Aggregate validation issues — mirrors `PanelProbleme`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel } from "@/lib/chargen/types";
import { isVeteranPhase } from "@/lib/chargen/types";
import { computeBudget, type BudgetSnapshot } from "@/lib/chargen/rules/budget";
import {
  computeMagicApSpent,
  educatedApApplied,
  educatedApSavings,
  specialAbilityGpSpent,
} from "@/lib/chargen/rules/budgetExtras";
import { checkSpecialAbilityPrerequisites } from "@/lib/chargen/rules/checkSpecialAbilityPrereqs";
import { checkTalentPrerequisites } from "@/lib/chargen/rules/checkTalentPrerequisites";
import {
  checkCombatAtPaSpread,
  checkSpellLevelCaps,
  checkTalentLevelCaps,
} from "@/lib/chargen/rules/talentCaps";
import {
  checkSpellRepresentation,
  checkSpellcaster,
} from "@/lib/chargen/rules/spellPrereqs";
import type { ChargenFinishMode } from "@/lib/chargen/settings";
import {
  checkActivationLimits,
  checkAttributeBounds,
  checkBausteinAttributeRequirements,
  checkBegabungUnfaehigkeit,
  checkGpCaps,
  checkKulturkunde,
  checkMaxFiveVariantTraits,
  checkRaceCultureProfession,
  type Konflikt,
} from "@/lib/chargen/rules/voraussetzungen";

export interface ProblemsResult {
  conflicts: Konflikt[];
  budget: BudgetSnapshot;
  canFinish: boolean;
  /** True when any special-ability prerequisite failed (show Java use-vs-select remark). */
  hasSpecialAbilityPrereqIssues?: boolean;
}

export function collectProblems(
  held: HeldModel,
  catalogContext?: {
    race?: {
      id?: string;
      name?: string;
      gp_cost?: number;
      allowed_cultures?: string[];
      attribute_modifiers?: Record<string, number>;
      attribute_minimums?: Record<string, number>;
      so_min?: number;
      so_max?: number;
    } | null;
    culture?: {
      id?: string;
      name?: string;
      gp_cost?: number;
      attribute_modifiers?: Record<string, number>;
      attribute_minimums?: Record<string, number>;
      so_min?: number;
      so_max?: number;
      professions?: {
        mode?: string;
        exclude?: string[];
        include?: string[];
      };
    } | null;
    profession?: {
      id?: string;
      name?: string;
      gp_cost?: number;
      attribute_modifiers?: Record<string, number>;
      so_min?: number;
      so_max?: number;
      attribute_minimums?: Record<string, number>;
    } | null;
    specialAbilities?: CatalogItem[];
    spells?: CatalogItem[];
    talents?: CatalogItem[];
    traits?: CatalogItem[];
    grantedSpecialAbilityIds?: string[];
    seededTalentIds?: Set<string>;
    resolveName?: (id: string) => string | undefined;
    traitGpNet?: number;
    attributeMods?: AttributeMods;
    finishMode?: ChargenFinishMode;
  }
): ProblemsResult {
  const attributeMods: AttributeMods = catalogContext?.attributeMods ?? {
    race: catalogContext?.race?.attribute_modifiers,
    culture: catalogContext?.culture?.attribute_modifiers,
    profession: catalogContext?.profession?.attribute_modifiers,
  };

  const budget = computeBudget(held, {
    raceGp: catalogContext?.race?.gp_cost ?? 0,
    cultureGp: catalogContext?.culture?.gp_cost ?? 0,
    professionGp: catalogContext?.profession?.gp_cost ?? 0,
    traitGpNet: catalogContext?.traitGpNet ?? 0,
    specialAbilityGp: specialAbilityGpSpent(
      held,
      catalogContext?.specialAbilities ?? []
    ),
    attributeMods,
    educatedApSaved: educatedApSavings(held),
    educatedApApplied: educatedApApplied(
      held,
      catalogContext?.talents ?? [],
      catalogContext?.specialAbilities ?? [],
      catalogContext?.spells ?? [],
      catalogContext?.seededTalentIds ?? new Set()
    ),
    magicApSpent: computeMagicApSpent(
      held,
      catalogContext?.spells ?? [],
      catalogContext?.specialAbilities ?? []
    ),
    profession: catalogContext?.profession as CatalogItem | null | undefined,
  });

  const veteran = isVeteranPhase(held);
  const attributesStillUnset = held.attributes
    .filter((a) => a.code !== "SO")
    .every((a) => a.base === 0);

  const conflicts: Konflikt[] = veteran
    ? []
    : [
        ...checkRaceCultureProfession(
          held,
          catalogContext?.race,
          catalogContext?.culture
        ),
        ...(attributesStillUnset
          ? []
          : [
              ...checkAttributeBounds(held),
              ...checkBausteinAttributeRequirements(
                held,
                {
                  race: catalogContext?.race,
                  culture: catalogContext?.culture,
                  profession: catalogContext?.profession,
                },
                attributeMods
              ),
            ]),
        ...checkBegabungUnfaehigkeit(held),
        ...checkMaxFiveVariantTraits(held),
        ...checkKulturkunde(
          held,
          catalogContext?.resolveName
            ? (id) => catalogContext.resolveName!(id) || id
            : undefined
        ),
        ...checkGpCaps(held, catalogContext?.traits ?? []),
        ...checkActivationLimits(
          held,
          catalogContext?.seededTalentIds ?? new Set()
        ),
      ];

  const sfConflicts = checkSpecialAbilityPrerequisites(
    held,
    catalogContext?.specialAbilities ?? [],
    {
      attributeMods,
      grantedIds: new Set(catalogContext?.grantedSpecialAbilityIds ?? []),
      resolveName: catalogContext?.resolveName,
    }
  );

  conflicts.push(
    ...checkSpellRepresentation(
      held,
      catalogContext?.spells ?? [],
      catalogContext?.resolveName
        ? (id) => catalogContext.resolveName!(id) || id
        : undefined
    ),
    ...checkSpellcaster(
      held,
      catalogContext?.spells ?? [],
      catalogContext?.resolveName
        ? (id) => catalogContext.resolveName!(id) || id
        : undefined
    ),
    ...sfConflicts,
    ...(attributesStillUnset
      ? []
      : [
          ...checkTalentLevelCaps(held, catalogContext?.talents ?? [], {
            attributeMods,
            resolveName: catalogContext?.resolveName,
          }),
          ...checkSpellLevelCaps(held, catalogContext?.spells ?? [], {
            attributeMods,
            resolveName: catalogContext?.resolveName,
          }),
        ]),
    ...checkCombatAtPaSpread(held, catalogContext?.talents ?? [], {
      attributeMods,
      resolveName: catalogContext?.resolveName,
    }),
    ...checkTalentPrerequisites(held, catalogContext?.talents ?? [], {
      seededIds: catalogContext?.seededTalentIds,
      resolveName: catalogContext?.resolveName,
    })
  );

  if (!veteran) {
    if (budget.gpRemaining < 0) {
      conflicts.push({
        code: "gp_overspend",
        message: `GP overspent by ${-budget.gpRemaining}.`,
        severity: "error",
        section: "budget",
      });
    }
    if (budget.apRemaining < 0) {
      conflicts.push({
        code: "ap_overspend",
        message: `AP overspent by ${-budget.apRemaining}.`,
        severity: "error",
        section: "budget",
      });
    }
    if (!held.name.trim()) {
      conflicts.push({
        code: "missing_name",
        message: "Hero name is required.",
        severity: "error",
        section: "general",
      });
    }
  } else if (held.apSpent > held.apTotal) {
    conflicts.push({
      code: "ap_overspend_veteran",
      message: `AP to spend: ${held.apSpent - held.apTotal} (spent exceeds total Adventure Points).`,
      severity: "warning",
      section: "budget",
    });
  }

  const hasErrors = conflicts.some((c) => c.severity === "error");
  const finishMode = catalogContext?.finishMode ?? "strict";
  const canFinish = finishMode === "advisory" ? true : !hasErrors;
  return {
    conflicts,
    budget,
    canFinish,
    hasSpecialAbilityPrereqIssues: sfConflicts.length > 0,
  };
}
