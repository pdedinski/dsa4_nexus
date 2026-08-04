/**
 * Ensure every key in professions.json talent_bias / talent_avoid_bias exists in data/talents.
 * Usage: node scripts/validate_profession_talent_bias.mjs
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

const profPath = path.join(root, "data", "core", "professions.json");
const data = JSON.parse(fs.readFileSync(profPath, "utf8"));
const validIds = loadAllTalentIds();
const unknown = [];

for (const prof of data.professions ?? []) {
  for (const key of ["talent_bias", "talent_avoid_bias"]) {
    const bias = prof?.[key];
    if (!bias || typeof bias !== "object") continue;
    for (const tid of Object.keys(bias)) {
      if (!validIds.has(tid)) unknown.push({ id: prof.id, key, tid });
    }
  }
  const mods = prof?.talent_modifiers;
  if (mods && typeof mods === "object") {
    for (const tid of Object.keys(mods)) {
      if (!validIds.has(tid))
        unknown.push({ id: prof.id, key: "talent_modifiers", tid });
    }
  }
}

if (unknown.length) {
  console.error("Unknown talent keys:");
  for (const row of unknown) {
    console.error(`  ${row.id}.${row.key}: "${row.tid}"`);
  }
  process.exit(1);
}

console.log(
  `profession talent_bias/avoid/modifiers: all keys match data/talents (${data.professions?.length ?? 0} professions).`
);
