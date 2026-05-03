#!/usr/bin/env node
/**
 * Expanded WdH culture stubs shipped with empty `allowed_races` / `allowed_professions`,
 * which breaks TypeScript inference and leaves no playable race↔culture intersection.
 * Derives races reciprocally from `races.json` and enables all professions for stub cultures
 * pending manual WdH verification.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function cultureIdsOnRace(race) {
  return (race.allowed_cultures ?? []).flatMap((c) =>
    c === "novadis" ? ["novadis_men", "novadis_women"] : [c],
  );
}

const races = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/core/races.json"), "utf8"),
).races;
const professions = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/core/professions.json"), "utf8"),
).professions;
const culturesPath = path.join(ROOT, "data/core/cultures.json");
const culturesFile = JSON.parse(fs.readFileSync(culturesPath, "utf8"));
const cultureList = culturesFile.cultures;

const allProfessionIds = professions.map((p) => p.id);
const patched = [];

for (const c of cultureList) {
  const cid = c.id;

  let ar = Array.isArray(c.allowed_races) ? [...c.allowed_races] : [];
  let ap = Array.isArray(c.allowed_professions) ? [...c.allowed_professions] : [];

  if (ar.length === 0) {
    ar = races
      .filter((r) => cultureIdsOnRace(r).includes(cid))
      .map((r) => r.id)
      .sort();
    if (ar.length === 0) ar = [...races.map((r) => r.id)].sort();
    patched.push(`${cid}: allowed_races (${ar.length})`);
  }

  if (ap.length === 0) {
    ap = [...allProfessionIds].sort();
    patched.push(`${cid}: allowed_professions all (${ap.length})`);
  }

  c.allowed_races = ar;
  c.allowed_professions = ap;
}

fs.writeFileSync(culturesPath, JSON.stringify(culturesFile, null, 2) + "\n");
console.log(patched.join("\n"));
