/**
 * Re-extract race/culture/profession JSON and restore manual overlays
 * (e.g. Magician gp_cost_by_race).
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "lib/chargen/data");
const profPath = path.join(dataDir, "professionen.json");

const prevProf = JSON.parse(fs.readFileSync(profPath, "utf8"));
const overlays = Object.fromEntries(
  prevProf
    .filter((p) => p.gp_cost_by_race)
    .map((p) => [p.id, { gp_cost_by_race: p.gp_cost_by_race }])
);

const extract = path.join(root, "scripts/chargen-extract/extract-all.mjs");
const r = spawnSync(process.execPath, [extract, "--bausteine-only"], {
  cwd: root,
  stdio: "inherit",
});
if (r.status !== 0) process.exit(r.status ?? 1);

const nextProf = JSON.parse(fs.readFileSync(profPath, "utf8"));
for (const p of nextProf) {
  const o = overlays[p.id];
  if (o) Object.assign(p, o);
}
fs.writeFileSync(profPath, JSON.stringify(nextProf, null, 2) + "\n");

const kult = JSON.parse(fs.readFileSync(path.join(dataDir, "kulturen.json"), "utf8"));
const au = kult.find((c) => c.id === "Kultur.Auelfen");
const leg = nextProf.find((p) => p.id === "Profession.Legendensaenger");
console.log("Auelfen lead_spell_count", au?.lead_spell_count);
console.log("Auelfen spell_bonuses", au?.spell_bonuses?.length);
console.log("Auelfen SF bonuses", au?.special_ability_bonuses?.length);
console.log("Legend spell_bonuses", leg?.spell_bonuses?.length);
console.log("Magier gp_cost_by_race", nextProf.find((p) => p.id === "Profession.Magier")?.gp_cost_by_race);
