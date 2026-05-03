/**
 * Merges Wege der Helden enriched races JSON into data/core/races.json.
 * - Enriched descriptions and any new fields win.
 * - Fills from the previous repo file when enriched omits structural keys.
 * - Normalizes `arrogance_or_vengefulness` into `pick_one_disadvantages` (same as cultures merge).
 *
 * Usage: node scripts/merge-races-enriched.mjs [races_enriched_wdh_english.json]
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT = "E:/Temp/downloads/races_enriched_wdh_english.json";
const REPO_RACES = path.join(process.cwd(), "data/core/races.json");

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

/** When enriched omits these, keep BRW-aligned data from the repo */
const FALLBACK_FIELDS_FROM_REPO = [
  "recommended_advantages",
  "recommended_disadvantages",
  "unsuitable_advantages",
  "unsuitable_disadvantages",
  "allowed_cultures",
  "talent_modifiers",
  "physical_appearance",
  "special_notes",
  "magic_status_notes",
  "elvish_upbringing_variant",
];

const enrichedPath = process.argv[2] || DEFAULT_INPUT;
const enrichedDoc = JSON.parse(fs.readFileSync(enrichedPath, "utf8"));
const prevDoc = JSON.parse(fs.readFileSync(REPO_RACES, "utf8"));
const prevById = new Map(prevDoc.races.map((r) => [r.id, r]));

const races = enrichedDoc.races.map((r) => {
  const out = deepClone(r);
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

const doc = { meta, races };
fs.mkdirSync(path.dirname(REPO_RACES), { recursive: true });
fs.writeFileSync(REPO_RACES, JSON.stringify(doc, null, 2), "utf8");
console.warn(
  `Wrote ${REPO_RACES} (${races.length} races) from ${enrichedPath}`,
);
