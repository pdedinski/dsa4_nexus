/**
 * Merges Wege der Helden enriched cultures JSON into data/core/cultures.json.
 * - Keeps enriched text and new tagging fields as primary.
 * - Fills from the previous cultures file when enriched omits list fields BRW relied on.
 * - Normalizes arrogant_or_vengefulness into pick_one_disadvantages for UI / sheets.
 *
 * Usage: node scripts/merge-cultures-enriched.mjs [cultures_enriched_wdh_english.json]
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT =
  "E:/Temp/downloads/cultures_enriched_wdh_english.json";
const REPO_CULTURES = path.join(process.cwd(), "data/core/cultures.json");

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function normalizeExclusiveDisadvantage(d) {
  if (!d || typeof d !== "object") return d;
  const o = d;
  if (o.id !== "arrogance_or_vengefulness") return d;
  const r = typeof o.rating === "number" ? o.rating : 5;
  return {
    id: "arrogance_or_vengefulness_choice",
    rating: r,
    note:
      typeof o.note === "string" && o.note.trim()
        ? o.note.trim()
        : "Choose exactly one: Arrogance or Vengefulness at this rating (not both).",
    pick_one_disadvantages: [
      { id: "arrogance", rating: r },
      { id: "vengefulness", rating: r },
    ],
  };
}

/** When enriched lacks these, keep BRW-aligned lists from the previous file */
const FALLBACK_FIELDS_FROM_REPO = [
  "recommended_advantages",
  "recommended_disadvantages",
  "unsuitable_advantages",
  "unsuitable_disadvantages",
  "talent_choice_modifiers",
];

const enrichedPath = process.argv[2] || DEFAULT_INPUT;
const enrichedDoc = JSON.parse(fs.readFileSync(enrichedPath, "utf8"));
const prevDoc = JSON.parse(fs.readFileSync(REPO_CULTURES, "utf8"));
const prevById = new Map(prevDoc.cultures.map((c) => [c.id, c]));

const cultures = enrichedDoc.cultures.map((c) => {
  const out = deepClone(c);
  const legacy = prevById.get(out.id);
  if (legacy) {
    for (const key of FALLBACK_FIELDS_FROM_REPO) {
      if (out[key] === undefined && legacy[key] !== undefined) {
        out[key] = deepClone(legacy[key]);
      }
    }
  }
  if (Array.isArray(out.automatic_disadvantages)) {
    out.automatic_disadvantages = out.automatic_disadvantages.map(
      normalizeExclusiveDisadvantage,
    );
  }
  return out;
});

const meta = { ...enrichedDoc.meta };

const doc = { meta, cultures };
fs.mkdirSync(path.dirname(REPO_CULTURES), { recursive: true });
fs.writeFileSync(REPO_CULTURES, JSON.stringify(doc, null, 2), "utf8");
console.warn(
  `Wrote ${REPO_CULTURES} (${cultures.length} cultures) from ${enrichedPath}`,
);
