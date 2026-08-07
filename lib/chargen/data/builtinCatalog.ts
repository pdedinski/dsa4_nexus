/**
 * Built-in chargen JSON catalogs (no DB). Safe to import from client components.
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

export function getBuiltinCatalogCategories(): ChargenCatalogCategory[] {
  return Object.keys(BUILTIN) as ChargenCatalogCategory[];
}
