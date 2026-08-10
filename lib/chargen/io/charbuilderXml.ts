/**
 * Import/export catalog weapons, shields and armor to/from the "TDE4 Charbuilder"
 * custom-data XML format (`meleeweapons.xml` / `rangedweapons.xml` / `shields.xml` /
 * `armor.xml`). This is the same attribute vocabulary as the Java Chargen native
 * `daten/diverses/{Nahkampfwaffen,Fernkampfwaffen,Ruestungen,Schilde}.xml` files
 * (see `scripts/chargen-extract/extract-all.mjs`), so parsed entries land in the
 * exact shape used by `lib/chargen/data/*.json` and the `chargen_data.*` catalog
 * tables.
 *
 * Note on dice notation: Charbuilder writes weapon damage as international
 * `NdM+X` (e.g. `3d6+2`); the builtin Nexus catalog inherits Java Chargen's
 * `NW+X` shorthand (e.g. `3W+2`). The `tp` field is display-only in the chargen
 * sheet, so we keep whatever notation the source file used rather than risk a
 * lossy rewrite.
 */

import { XMLParser } from "fast-xml-parser";
import {
  getBuiltinCatalog,
  type CatalogItem,
} from "@/lib/chargen/data/builtinCatalog";
import { mergeCustomCatalogItem } from "@/lib/chargen/data/mergeCatalogItem";
import { decodeXmlEntities } from "@/lib/chargen/io/xmlEntities";

export type CharbuilderXmlCategory =
  | "melee_weapons"
  | "ranged_weapons"
  | "armor"
  | "shields";

export const CHARBUILDER_XML_CATEGORIES: CharbuilderXmlCategory[] = [
  "melee_weapons",
  "ranged_weapons",
  "armor",
  "shields",
];

const ROOT_TAG: Record<CharbuilderXmlCategory, string> = {
  melee_weapons: "Waffen",
  ranged_weapons: "Fernwaffen",
  armor: "Ruestungen",
  shields: "Schilde",
};

const ITEM_TAG: Record<CharbuilderXmlCategory, string> = {
  melee_weapons: "Waffe",
  ranged_weapons: "Fernwaffe",
  armor: "Ruestung",
  shields: "Schild",
};

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

import { decodeXmlEntities } from "@/lib/chargen/io/xmlEntities";

function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") {
    return decodeXmlEntities(String(v));
  }
  if (typeof v === "object" && v && "#text" in (v as object)) {
    return decodeXmlEntities(String((v as { "#text": unknown })["#text"]));
  }
  return "";
}

function attr(w: Record<string, unknown>, key: string): string {
  const v = w[`@_${key}`];
  return v != null ? decodeXmlEntities(String(v)) : "";
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fallback display name from a dotted id, e.g. "Waffe.GrosserLederschild" -> "Grosser Lederschild". */
function humanizeId(id: string): string {
  const seg = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
  return seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function makeParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) => ["Waffe", "Fernwaffe", "Ruestung", "Schild", "Talent"].includes(name),
  });
}

/** Sniff which category a Charbuilder-style XML file holds, from its root tag. */
export function detectCharbuilderXmlCategory(
  xml: string
): CharbuilderXmlCategory | null {
  for (const cat of CHARBUILDER_XML_CATEGORIES) {
    const root = ROOT_TAG[cat];
    if (new RegExp(`<\\s*${root}[\\s>]`).test(xml)) return cat;
  }
  return null;
}

function parseMelee(root: Record<string, unknown>): CatalogItem[] {
  return asArray(root[ITEM_TAG.melee_weapons] as unknown[]).map((raw) => {
    const w = raw as Record<string, unknown>;
    const id = attr(w, "Id");
    const nameAttr = attr(w, "Name");
    const fallback = humanizeId(id);
    const talent = attr(w, "Talent") || undefined;
    const talents = asArray(w.Talent as unknown[]).map(textOf).filter(Boolean);
    return {
      id,
      name: nameAttr || fallback,
      german_name: fallback,
      talent,
      talents: talents.length ? talents : talent ? [talent] : [],
      tp: attr(w, "Tp") || undefined,
      bf: Number(w["@_Bf"] ?? 0),
      ini: Number(w["@_Ini"] ?? 0),
      wm_at: Number(w["@_WmAt"] ?? 0),
      wm_pa: Number(w["@_WmPa"] ?? 0),
      dk_h: String(w["@_DkH"]) === "true",
      dk_n: String(w["@_DkN"]) === "true",
      dk_s: String(w["@_DkS"]) === "true",
      damage_threshold: Number(w["@_Schwellenwert"] ?? 0),
      damage_step: Number(w["@_Schadensschritt"] ?? 0),
      source: "custom",
    } as CatalogItem;
  });
}

function parseRanged(root: Record<string, unknown>): CatalogItem[] {
  return asArray(root[ITEM_TAG.ranged_weapons] as unknown[]).map((raw) => {
    const w = raw as Record<string, unknown>;
    const id = attr(w, "Id");
    const nameAttr = attr(w, "Name");
    const fallback = humanizeId(id);
    const weightRaw = w["@_Gewicht"];
    return {
      id,
      name: nameAttr || fallback,
      german_name: fallback,
      talent: attr(w, "Talent") || undefined,
      tp: attr(w, "Tp") || undefined,
      ranges: String(w["@_Reichtweiten"] ?? w["@_Reichweiten"] ?? "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => !Number.isNaN(n)),
      tp_plus: String(w["@_TpPlus"] ?? "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => !Number.isNaN(n)),
      ...(weightRaw != null ? { weight: Number(weightRaw) } : {}),
      source: "custom",
    } as CatalogItem;
  });
}

function parseArmor(root: Record<string, unknown>): CatalogItem[] {
  return asArray(root[ITEM_TAG.armor] as unknown[]).map((raw) => {
    const r = raw as Record<string, unknown>;
    const id = attr(r, "Id");
    const nameAttr = attr(r, "Name");
    const fallback = humanizeId(id);
    const priceRaw = r["@_Preis"];
    const weightRaw = r["@_Gewicht"];
    return {
      id,
      name: nameAttr || fallback,
      german_name: fallback,
      rs: Number(r["@_RS"] ?? 0),
      be: Number(r["@_BE"] ?? 0),
      additional: String(r["@_Zusatzruestung"]) === "true",
      min_torso_rs:
        r["@_MindestTorsoRs"] != null ? Number(r["@_MindestTorsoRs"]) : null,
      ...(priceRaw != null ? { price: Number(priceRaw) } : {}),
      ...(weightRaw != null ? { weight: Number(weightRaw) } : {}),
      source: "custom",
    } as CatalogItem;
  });
}

function parseShields(root: Record<string, unknown>): CatalogItem[] {
  return asArray(root[ITEM_TAG.shields] as unknown[]).map((raw) => {
    const s = raw as Record<string, unknown>;
    const id = attr(s, "Id");
    const nameAttr = attr(s, "Name");
    const fallback = humanizeId(id);
    return {
      id,
      name: nameAttr || fallback,
      german_name: fallback,
      type: attr(s, "Typ") || undefined,
      bf: Number(s["@_Bf"] ?? 0),
      ini: Number(s["@_Ini"] ?? 0),
      wm_at: Number(s["@_WmAt"] ?? 0),
      wm_pa: Number(s["@_WmPa"] ?? 0),
      source: "custom",
    } as CatalogItem;
  });
}

/**
 * Parse a Charbuilder-format XML document for the given category into catalog
 * entries (same shape as `lib/chargen/data/*.json`, `source: "custom"`).
 * Throws if the root tag doesn't match the expected category.
 */
export function parseCharbuilderXml(
  category: CharbuilderXmlCategory,
  xml: string
): CatalogItem[] {
  const parsed = makeParser().parse(xml) as Record<string, unknown>;
  const root = parsed[ROOT_TAG[category]] as Record<string, unknown> | undefined;
  if (!root) {
    throw new Error(
      `Expected a <${ROOT_TAG[category]}> root element for ${category.replace(/_/g, " ")}.`
    );
  }
  let items: CatalogItem[];
  switch (category) {
    case "melee_weapons":
      items = parseMelee(root);
      break;
    case "ranged_weapons":
      items = parseRanged(root);
      break;
    case "armor":
      items = parseArmor(root);
      break;
    case "shields":
      items = parseShields(root);
      break;
  }
  const builtinById = new Map(
    getBuiltinCatalog(category).map((b) => [b.id, b])
  );
  return items.map((item) =>
    mergeCustomCatalogItem(item, builtinById.get(item.id), category)
  );
}

/** Build `Key="value"` attribute fragments, skipping nullish values, in the given order. */
function attrs(pairs: Array<[string, string | number | boolean | null | undefined]>): string {
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}="${esc(String(v))}"`)
    .join(" ");
}

function serializeMelee(items: CatalogItem[]): string {
  const lines = [`<${ROOT_TAG.melee_weapons}>`];
  for (const it of items) {
    const talents = (it.talents as string[] | undefined) ?? [];
    const body = attrs([
      ["Bf", (it.bf as number) ?? 0],
      ["DkH", it.dk_h ? "true" : "false"],
      ["DkN", it.dk_n ? "true" : "false"],
      ["DkS", it.dk_s ? "true" : "false"],
      ["Id", it.id],
      ["Ini", (it.ini as number) ?? 0],
      ["Name", it.name && it.name !== it.german_name ? it.name : null],
      ["Schadensschritt", (it.damage_step as number) ?? 0],
      ["Schwellenwert", (it.damage_threshold as number) ?? 0],
      ["Talent", it.talent as string | undefined],
      ["Tp", it.tp as string | undefined],
      ["WmAt", (it.wm_at as number) ?? 0],
      ["WmPa", (it.wm_pa as number) ?? 0],
    ]);
    if (talents.length) {
      lines.push(`    <${ITEM_TAG.melee_weapons} ${body}>`);
      for (const t of talents) lines.push(`        <Talent>${esc(t)}</Talent>`);
      lines.push(`    </${ITEM_TAG.melee_weapons}>`);
    } else {
      lines.push(`    <${ITEM_TAG.melee_weapons} ${body}/>`);
    }
  }
  lines.push(`</${ROOT_TAG.melee_weapons}>`);
  return lines.join("\n");
}

function serializeRanged(items: CatalogItem[]): string {
  const lines = [`<${ROOT_TAG.ranged_weapons}>`];
  for (const it of items) {
    const ranges = (it.ranges as number[] | undefined) ?? [];
    const tpPlus = (it.tp_plus as number[] | undefined) ?? [];
    const body = attrs([
      ["Gewicht", it.weight as number | undefined],
      ["Id", it.id],
      ["Name", it.name && it.name !== it.german_name ? it.name : null],
      ["Reichtweiten", ranges.length ? ranges.join(",") : null],
      ["Talent", it.talent as string | undefined],
      ["Tp", it.tp as string | undefined],
      ["TpPlus", tpPlus.length ? tpPlus.join(",") : null],
    ]);
    lines.push(`    <${ITEM_TAG.ranged_weapons} ${body}/>`);
  }
  lines.push(`</${ROOT_TAG.ranged_weapons}>`);
  return lines.join("\n");
}

function serializeArmor(items: CatalogItem[]): string {
  const lines = [`<${ROOT_TAG.armor}>`];
  for (const it of items) {
    const body = attrs([
      ["BE", (it.be as number) ?? 0],
      ["Gewicht", it.weight as number | undefined],
      ["Id", it.id],
      ["MindestTorsoRs", it.min_torso_rs as number | null | undefined],
      ["Name", it.name && it.name !== it.german_name ? it.name : null],
      ["Preis", it.price as number | undefined],
      ["RS", (it.rs as number) ?? 0],
      ["Zusatzruestung", it.additional ? "true" : "false"],
    ]);
    lines.push(`    <${ITEM_TAG.armor} ${body}/>`);
  }
  lines.push(`</${ROOT_TAG.armor}>`);
  return lines.join("\n");
}

function serializeShields(items: CatalogItem[]): string {
  const lines = [`<${ROOT_TAG.shields}>`];
  for (const it of items) {
    const body = attrs([
      ["Bf", (it.bf as number) ?? 0],
      ["Id", it.id],
      ["Ini", (it.ini as number) ?? 0],
      ["Name", it.name && it.name !== it.german_name ? it.name : null],
      ["Typ", it.type as string | undefined],
      ["WmAt", (it.wm_at as number) ?? 0],
      ["WmPa", (it.wm_pa as number) ?? 0],
    ]);
    lines.push(`    <${ITEM_TAG.shields} ${body}/>`);
  }
  lines.push(`</${ROOT_TAG.shields}>`);
  return lines.join("\n");
}

/** Serialize catalog entries back to the Charbuilder XML format for the given category. */
export function serializeCharbuilderXml(
  category: CharbuilderXmlCategory,
  items: CatalogItem[]
): string {
  const body = (() => {
    switch (category) {
      case "melee_weapons":
        return serializeMelee(items);
      case "ranged_weapons":
        return serializeRanged(items);
      case "armor":
        return serializeArmor(items);
      case "shields":
        return serializeShields(items);
    }
  })();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;
}

export function downloadCharbuilderXml(
  category: CharbuilderXmlCategory,
  items: CatalogItem[],
  filename?: string
): void {
  const xml = serializeCharbuilderXml(category, items);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${category}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
