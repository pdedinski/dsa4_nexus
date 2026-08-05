/**
 * Merge built-in JSON catalogs with optional `chargen_data` DB rows.
 * Never throws — DB failures set catalogWarning and return built-ins only.
 */

import rassen from "@/lib/chargen/data/rassen.json";
import kulturen from "@/lib/chargen/data/kulturen.json";
import professionen from "@/lib/chargen/data/professionen.json";
import waffenNahkampf from "@/lib/chargen/data/waffen_nahkampf.json";
import waffenFernkampf from "@/lib/chargen/data/waffen_fernkampf.json";
import ruestungen from "@/lib/chargen/data/ruestungen.json";
import schilde from "@/lib/chargen/data/schilde.json";
import talente from "@/lib/chargen/data/talente.json";
import zauber from "@/lib/chargen/data/zauber.json";
import vornachteile from "@/lib/chargen/data/vornachteile.json";
import sonderfertigkeiten from "@/lib/chargen/data/sonderfertigkeiten.json";
import type { ChargenCatalogCategory } from "@/lib/chargen/types";

export type CatalogItem = Record<string, unknown> & {
  id: string;
  name?: string;
  source?: "builtin" | "custom";
};

export interface CatalogLoadResult<T extends CatalogItem = CatalogItem> {
  items: T[];
  catalogWarning: boolean;
  warningMessage?: string;
}

const BUILTIN: Record<ChargenCatalogCategory, CatalogItem[]> = {
  races: rassen as CatalogItem[],
  cultures: kulturen as CatalogItem[],
  professions: professionen as CatalogItem[],
  melee_weapons: waffenNahkampf as CatalogItem[],
  ranged_weapons: waffenFernkampf as CatalogItem[],
  armor: ruestungen as CatalogItem[],
  shields: schilde as CatalogItem[],
  talents: talente as CatalogItem[],
  spells: zauber as CatalogItem[],
  advantages_disadvantages: vornachteile as CatalogItem[],
  special_abilities: sonderfertigkeiten as CatalogItem[],
};

function tagBuiltin(items: CatalogItem[]): CatalogItem[] {
  return items.map((i) => ({ ...i, source: i.source ?? "builtin" }));
}

export function getBuiltinCatalog(
  category: ChargenCatalogCategory
): CatalogItem[] {
  return tagBuiltin(BUILTIN[category] ?? []);
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
    // Custom overrides same id; otherwise append
    const byId = new Map<string, CatalogItem>();
    for (const b of builtin) byId.set(b.id, b);
    for (const c of custom) byId.set(c.id, c);
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
  const categories = Object.keys(BUILTIN) as ChargenCatalogCategory[];
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
