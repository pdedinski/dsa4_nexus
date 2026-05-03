#!/usr/bin/env node
/**
 * Restrict data/core/professions.json to DSA Basisregelwerk (BRW) entries only (`source`
 * begins with `BRW `). Drops Wege der Helden / supplemental professions.
 *
 * Revalidates `allowed_professions` / `excluded_professions` in cultures.json against
 * the surviving profession IDs. Cultures whose allowlist becomes empty are reset to all
 * base professions so chargen intersections stay non-empty.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const profPath = path.join(root, "data/core/professions.json");
const culturesPath = path.join(root, "data/core/cultures.json");
const germanMapPath = path.join(root, "data/meta/profession_german_to_english.json");

const KEEP_PREFIX = "BRW";

const pkg = JSON.parse(fs.readFileSync(profPath, "utf8"));
const removed = [];
const kept = [];

for (const p of pkg.professions) {
  const src = p.source ?? "";
  if (typeof src === "string" && src.startsWith(KEEP_PREFIX)) {
    kept.push(p);
  } else {
    removed.push(p.id);
  }
}

if (removed.length === 0) {
  console.log("No professions removed (nothing matched non-" + KEEP_PREFIX + " criteria).");
} else {
  console.log(`Removed ${removed.length} professions, kept ${kept.length}.`);
}

pkg.meta = {
  ...pkg.meta,
  last_updated: "2026-05-03",
  description:
    "Professions encoded from DSA 4.1 Basisregelwerk (BRW): talent modifiers cumulate with race and culture; automatic advantages/disadvantages live in gp_cost; choice_blocks are mandatory picks. Expanded Wege der Helden entries were deliberately excluded for BR-only tooling.",
  source_books: [
    "DSA 4.1 Basisregelwerk p. 73–83",
    "TDE Basic Rules p. 51–57",
  ],
};

pkg.professions = kept;
fs.writeFileSync(profPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

const validIds = new Set(kept.map((p) => p.id));
const allSorted = [...validIds].sort();

const germanMap = {};
for (const p of kept) {
  const gn = typeof p.german_name === "string" ? p.german_name.trim() : "";
  if (gn && gn !== p.name) {
    germanMap[p.german_name] = p.name;
  }
}
fs.writeFileSync(germanMapPath, `${JSON.stringify(germanMap, null, 2)}\n`, "utf8");

const culturesFile = JSON.parse(fs.readFileSync(culturesPath, "utf8"));
const emptied = [];

for (const c of culturesFile.cultures) {
  if (Array.isArray(c.allowed_professions)) {
    let next = [...new Set(c.allowed_professions.filter((id) => validIds.has(id)))].sort();
    if (next.length === 0) {
      next = [...allSorted];
      emptied.push(c.id);
    }
    c.allowed_professions = next;
  }
  if (Array.isArray(c.excluded_professions)) {
    c.excluded_professions = [
      ...new Set(c.excluded_professions.filter((id) => validIds.has(id))),
    ].sort();
  }
}

fs.writeFileSync(culturesPath, `${JSON.stringify(culturesFile, null, 2)}\n`, "utf8");

if (emptied.length) {
  console.log(`Cultures reset to all base professions (${allSorted.length}):`);
  emptied.forEach((id) => console.log(`  - ${id}`));
}
