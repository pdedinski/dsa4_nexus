/**
 * When a custom catalog entry overrides a builtin by the same id, adopt the
 * builtin English `name` (and German `german_name`) if the custom labels look
 * like unlocalized import fallbacks rather than deliberate renames.
 */

import type { CatalogItem } from "@/lib/chargen/data/builtinCatalog";

type NamedCatalogItem = Pick<CatalogItem, "id" | "name"> & {
  german_name?: unknown;
};

function idSegment(id: string): string {
  return id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
}

/** Same fallback importers use: "Waffe.GrosserLederschild" → "Grosser Lederschild". */
function humanizeId(id: string): string {
  return idSegment(id).replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function looksLikeIdFallback(value: string, id: string): boolean {
  if (!value) return true;
  const seg = idSegment(id);
  return value === seg || value === humanizeId(id);
}

/**
 * True when `custom.name` appears to be an import/id fallback rather than a
 * deliberate display name.
 */
export function isUnlocalizedName(
  custom: NamedCatalogItem,
  builtin: NamedCatalogItem
): boolean {
  const name = str(custom.name);
  if (!name) return true;
  const germanName = str(custom.german_name);
  const builtinGerman = str(builtin.german_name);
  if (germanName && name === germanName) return true;
  if (looksLikeIdFallback(name, custom.id)) return true;
  if (builtinGerman && name === builtinGerman) return true;
  return false;
}

/**
 * Copy builtin English/German display names onto a custom override when the
 * custom labels look unlocalized. Returns `custom` unchanged when there is no
 * matching builtin or names look intentional.
 */
export function applyBuiltinLocalization<T extends CatalogItem>(
  custom: T,
  builtin: CatalogItem | undefined
): T {
  if (!builtin) return custom;

  const name = str(custom.name);
  const germanName = str(custom.german_name);
  const builtinName = str(builtin.name);
  const builtinGerman = str(builtin.german_name);

  let nextName = name || custom.id;
  let nextGerman = germanName;

  if (isUnlocalizedName(custom, builtin) && builtinName) {
    nextName = builtinName;
  }

  if (looksLikeIdFallback(germanName, custom.id) && builtinGerman) {
    nextGerman = builtinGerman;
  }

  if (nextName === name && nextGerman === germanName) {
    return custom;
  }

  return {
    ...custom,
    name: nextName,
    ...(nextGerman ? { german_name: nextGerman } : {}),
  };
}
