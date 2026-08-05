/**
 * Build attribute modifier maps from catalog race/culture/profession rows.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods } from "@/lib/chargen/types";

export function buildAttributeMods(
  race?: CatalogItem | null,
  culture?: CatalogItem | null,
  profession?: CatalogItem | null
): AttributeMods {
  return {
    race: (race?.attribute_modifiers as Record<string, number>) || {},
    culture: (culture?.attribute_modifiers as Record<string, number>) || {},
    profession:
      (profession?.attribute_modifiers as Record<string, number>) || {},
  };
}
