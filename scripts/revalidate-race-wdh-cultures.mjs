#!/usr/bin/env node
/**
 * Refresh WdH `chargen_*` bridged races with matching cultures.json IDs (WdH-expanded)
 * while keeping Basisregelwerk culture entries already present.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function sortUnique(ids) {
  return [...new Set(ids.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

const culturesPath = path.join(ROOT, "data/core/cultures.json");
const racesPath = path.join(ROOT, "data/core/races.json");
const cultureIds = new Set(
  JSON.parse(fs.readFileSync(culturesPath, "utf8")).cultures.map((c) => c.id),
);

const NEW_NOTE =
  "Wege der Helden names homeland cultures beyond the Basisregelwerk; Nexus exposes those as cultures.json IDs where available alongside BR cultures so random pairing stays broad.";

/** merge(WdH ids to add…) */
const PATCHES = {
  nivesian: [
    "bornland",
    "middenrealm_cities",
    "andergast_nostria",
    "fjarninger",
    "maraskan",
    "nivesian_tribes",
    "svellt_valley_northern_lands",
  ],
  norbard: [
    "andergast_nostria",
    "bornland",
    "gjalskerland",
    "middenrealm_cities",
    "norbard_clan",
    "svellt_valley_northern_lands",
    "thorwal",
  ],
  trollzacker: [
    "bornland",
    "gjalskerland",
    "svellt_valley_northern_lands",
    "thorwal",
    "troll_peaks",
  ],
  rochshaz: [
    "bornland",
    "gjalskerland",
    "svellt_valley_northern_lands",
    "thorwal",
    "troll_peaks",
  ],
  tocamuyac: [
    "forest_island_utulus",
    "jungle_tribes",
    "miniwatu",
    "tocamuyac",
    "southern_aventuria",
    "tulamidian_city_states",
  ],
  forest_elf: [
    "elven_settlement",
    "forest_elven_clan",
    "lea_elves",
    "steppe_elven_clan",
  ],
  firn_elf: ["firn_elven_clan", "lea_elves"],
  standard_dwarf: ["anvil_dwarves", "brilliant_dwarves", "hill_dwarves", "ore_dwarves"],
  brilliant_dwarf: ["anvil_dwarves", "brilliant_dwarves", "hill_dwarves", "ore_dwarves"],
  wild_dwarf: ["brobim"],
  ork: [
    "bornland",
    "middenrealm_cities",
    "orkland",
    "southern_aventuria",
    "svellt_occupiers",
    "thorwal",
  ],
  ork_woman: [
    "bornland",
    "middenrealm_cities",
    "orkland",
    "southern_aventuria",
    "svellt_occupiers",
    "thorwal",
  ],
  half_orc: [
    "middenrealm_cities",
    "orkland",
    "southern_aventuria",
    "svellt_occupiers",
    "thorwal",
    "tulamidian_city_states",
  ],
  goblin: [
    "goblin_band",
    "goblin_tribe",
    "middenrealm_cities",
    "southern_aventuria",
    "tulamidian_city_states",
  ],
  goblin_woman: [
    "goblin_band",
    "goblin_tribe",
    "middenrealm_cities",
    "southern_aventuria",
    "tulamidian_city_states",
  ],
  achaz: [
    "archaic_achaz",
    "festum_ghetto",
    "tribal_achaz",
    "southern_aventuria",
    "tulamidian_city_states",
  ],
  forest_island_achaz: [
    "forest_island_utulus",
    "miniwatu",
    "tulamidian_city_states",
    "southern_aventuria",
  ],
  maraskan_achaz: [
    "maraskan",
    "horasian_empire",
    "tulamidian_city_states",
    "tribal_achaz",
    "festum_ghetto",
    "archaic_achaz",
    "southern_aventuria",
  ],
  orkland_achaz: ["tribal_achaz"],
};

const racesFile = JSON.parse(fs.readFileSync(racesPath, "utf8"));
let patched = [];

for (const r of racesFile.races) {
  const pid = PATCHES[r.id];
  if (!pid) continue;
  const miss = pid.filter((x) => !cultureIds.has(x));
  if (miss.length) throw new Error(`Missing culture IDs for patch ${r.id}: ${miss.join(",")}`);
  const next = sortUnique(pid);
  if (JSON.stringify(r.allowed_cultures) !== JSON.stringify(next))
    patched.push(`${r.id}: cultures ${r.allowed_cultures?.length ?? 0} → ${next.length}`);
  r.allowed_cultures = next;
  if ("chargen_culture_bridge_note" in r)
    r.chargen_culture_bridge_note = NEW_NOTE;
}

fs.writeFileSync(racesPath, JSON.stringify(racesFile, null, 2) + "\n");
console.log(patched.join("\n") || "No allowed_cultures changes.");
