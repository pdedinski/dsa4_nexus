/**
 * Imports Wege der Zauberei summoned-creatures JSON into data/bestiary/summoned_creatures.json.
 *
 * Default input is the TruePDF extraction. Run:
 *   node scripts/transform-wdz-summons.mjs [input.json]
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT =
  "E:/Temp/downloads/wdz_invoked_creatures_truepdf_en.json";
const OUTPUT = path.join(
  process.cwd(),
  "data/bestiary/summoned_creatures.json",
);

/** Common extraction typo in some string fields only (not IDs). */
const TYPO_BOOK = /\bWege der Magicei\b/gi;

function fixBook(str) {
  return String(str).replace(TYPO_BOOK, "Wege der Zauberei");
}

const inputPath = process.argv[2] || DEFAULT_INPUT;
const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const creatures = raw.summoned_creatures;
if (!Array.isArray(creatures)) {
  console.error("Expected summoned_creatures array");
  process.exit(1);
}

const cleaned = [];

for (const c of creatures) {
  const next = { ...c };
  if (next.language === "English") delete next.language;

  for (const k of ["source", "source_book", "source_pdf", "description"]) {
    if (typeof next[k] === "string") next[k] = fixBook(next[k]);
  }

  cleaned.push(next);
}

const prevMeta =
  typeof raw.meta === "object" && raw.meta !== null ? { ...raw.meta } : {};

for (const k of [
  "description",
  "source_file",
  "source_pages",
  "extraction_notes",
]) {
  const v = prevMeta[k];
  if (typeof v === "string") prevMeta[k] = fixBook(v);
  else if (Array.isArray(v)) {
    prevMeta[k] = v.map((x) =>
      typeof x === "string" ? fixBook(x) : x,
    );
  }
}

const reviewCount = cleaned.filter((x) => x.needs_data_review === true).length;

const meta = {
  ...prevMeta,
  schema_version: prevMeta.schema_version ?? "2.0",
  entry_count: cleaned.length,
  entries_flagged_review: reviewCount,
};

const doc = { meta, summoned_creatures: cleaned };

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(doc, null, 2), "utf8");
console.warn(
  `Wrote ${OUTPUT} (${cleaned.length} entries, ${reviewCount} flagged needs_data_review).`,
);
