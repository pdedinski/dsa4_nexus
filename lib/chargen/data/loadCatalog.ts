/**
 * Merge built-in JSON catalogs with optional `chargen_data` DB rows.
 * Never throws — DB failures set catalogWarning and return built-ins only.
 *
 * Server-only: imports the DB client. Client code needing builtins should import
 * from `@/lib/chargen/data/builtinCatalog` instead.
 */

import { applyBuiltinLocalization } from "@/lib/chargen/data/builtinLocalization";
import {
  getBuiltinCatalog,
  getBuiltinCatalogCategories,
  type CatalogItem,
} from "@/lib/chargen/data/builtinCatalog";
import type { ChargenCatalogCategory } from "@/lib/chargen/types";

export type { CatalogItem } from "@/lib/chargen/data/builtinCatalog";
export { getBuiltinCatalog } from "@/lib/chargen/data/builtinCatalog";

export interface CatalogLoadResult<T extends CatalogItem = CatalogItem> {
  items: T[];
  catalogWarning: boolean;
  warningMessage?: string;
}

export async function loadCatalog(
  category: ChargenCatalogCategory
): Promise<CatalogLoadResult> {
  const builtin = getBuiltinCatalog(category);
  try {
    const { db } = await import("@/lib/db/client");
    const { chargenCatalogTables } = await import("@/lib/db/chargenSchema");
    const table = chargenCatalogTables[category];
    if (!table) {
      return { items: builtin, catalogWarning: false };
    }
    const rows = await db.select().from(table);
    const custom: CatalogItem[] = rows.map((row) => {
      const data =
        typeof row.data === "object" && row.data
          ? (row.data as Record<string, unknown>)
          : {};
      return {
        ...data,
        id: row.entityId,
        name: (data.name as string) || row.entityId,
        source: "custom" as const,
        _dbId: row.id,
        _notes: row.notes,
      };
    });
    // Custom overrides same id; otherwise append.
    // When overriding a builtin, keep English (and German) display names from
    // the builtin if the custom labels look like unlocalized import fallbacks.
    const byId = new Map<string, CatalogItem>();
    for (const b of builtin) byId.set(b.id, b);
    for (const c of custom) {
      const existing = byId.get(c.id);
      const priorBuiltin =
        existing?.source === "builtin" || existing?.source == null
          ? existing
          : undefined;
      byId.set(c.id, applyBuiltinLocalization(c, priorBuiltin));
    }
    return {
      items: Array.from(byId.values()),
      catalogWarning: false,
    };
  } catch (err) {
    console.warn(`[chargen] catalog load failed for ${category}:`, err);
    return {
      items: builtin,
      catalogWarning: true,
      warningMessage: `Additional/custom ${category.replace(/_/g, " ")} could not be loaded.`,
    };
  }
}

export async function loadAllCatalogs(): Promise<{
  catalogs: Record<ChargenCatalogCategory, CatalogItem[]>;
  warnings: string[];
}> {
  const categories = getBuiltinCatalogCategories();
  const catalogs = {} as Record<ChargenCatalogCategory, CatalogItem[]>;
  const warnings: string[] = [];
  await Promise.all(
    categories.map(async (cat) => {
      const res = await loadCatalog(cat);
      catalogs[cat] = res.items;
      if (res.catalogWarning && res.warningMessage) {
        warnings.push(res.warningMessage);
      }
    })
  );
  return { catalogs, warnings };
}
