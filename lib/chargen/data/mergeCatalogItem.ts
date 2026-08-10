/**
 * Merge a custom catalog row over a matching builtin entry.
 *
 * Custom XML imports often omit fields the Java extract stores (armor price/weight,
 * ranged weight, etc.). Spreading builtin first keeps those, while custom values
 * still win for fields the import did provide. Also repairs empty AlleVon
 * profession allow-lists left by older culture imports.
 */

import { applyBuiltinLocalization } from "@/lib/chargen/data/builtinLocalization";
import type { CatalogItem } from "@/lib/chargen/data/builtinCatalog";
import {
  resolveCultureProfessionFilter,
  type CultureProfessionFilter,
} from "@/lib/chargen/rules/availability";
import type { ChargenCatalogCategory } from "@/lib/chargen/types";

export function mergeCustomCatalogItem(
  custom: CatalogItem,
  builtin: CatalogItem | undefined,
  category?: ChargenCatalogCategory
): CatalogItem {
  const base: CatalogItem = builtin
    ? {
        ...builtin,
        ...custom,
        id: custom.id,
        source: "custom",
        ...(custom._dbId != null ? { _dbId: custom._dbId } : {}),
        ...(custom._notes != null ? { _notes: custom._notes } : {}),
      }
    : { ...custom, source: "custom" as const };

  let merged = applyBuiltinLocalization(base, builtin);

  if (category === "cultures" && builtin) {
    const professions = resolveCultureProfessionFilter(
      custom.professions as CultureProfessionFilter | undefined,
      builtin.professions as CultureProfessionFilter | undefined
    );
    if (professions) {
      merged = { ...merged, professions };
    }
  }

  return merged;
}
