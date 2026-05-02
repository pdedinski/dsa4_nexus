/**
 * Ensure every key in concept_weights.json talent_bias exists in data/talents.
 * Usage: node scripts/validate_concept_talent_bias.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const TALENT_FILES = [
  "combat_talents.json",
  "physical_talents.json",
  "social_talents.json",
  "nature_talents.json",
  "lore_talents.json",
  "artisan_talents.json",
  "languages_scripts.json",
];

function loadAllTalentIds() {
  const ids = new Set();
  for (const f of TALENT_FILES) {
    const p = path.join(root, "data", "talents", f);
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const t of j.talents ?? []) {
      if (t && typeof t.id === "string") ids.add(t.id);
    }
  }
  return ids;
}

const conceptPath = path.join(root, "data", "concepts", "concept_weights.json");
const concept = JSON.parse(fs.readFileSync(conceptPath, "utf8"));
const validIds = loadAllTalentIds();
const unknown = [];

for (const [conceptId, cfg] of Object.entries(concept.concepts ?? {})) {
  const bias = cfg?.talent_bias;
  if (!bias || typeof bias !== "object") continue;
  for (const tid of Object.keys(bias)) {
    if (!validIds.has(tid)) unknown.push({ conceptId, tid });
  }
}

if (unknown.length) {
  console.error("Unknown talent_bias keys:");
  for (const { conceptId, tid } of unknown) {
    console.error(`  ${conceptId}: "${tid}"`);
  }
  process.exit(1);
}

console.log("concept talent_bias: all keys match data/talents.");
