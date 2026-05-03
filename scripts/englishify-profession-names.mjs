/**
 * Applies data/meta/profession_german_to_english.json to data/core/professions.json:
 * rows where name === german_name get english `name`; `german_name` keeps the German label.
 * Ids *_p117 / *_p180 get a short suffix to disambiguate duplicate display labels.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const profPath = path.join(root, "data/core/professions.json");
const mapPath = path.join(root, "data/meta/profession_german_to_english.json");

const pkg = JSON.parse(fs.readFileSync(profPath, "utf8"));
const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));

let updated = 0;
for (const p of pkg.professions) {
  if (p.name !== p.german_name) continue;

  const de = p.name;
  const en = map[de];
  if (en === undefined || en === "") {
    throw new Error(`Missing English for profession id=${p.id} german=${JSON.stringify(de)}`);
  }

  let name = en;
  if (/_p117$/.test(p.id)) {
    name = `${name} (alternate stat block)`;
  } else if (/_p180$/.test(p.id)) {
    name = `${name} (alternate spell block)`;
  }

  p.german_name = de;
  p.name = name;
  updated++;
}

console.log(`Updated ${updated} professions (${pkg.professions.length} total).`);
fs.writeFileSync(profPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
