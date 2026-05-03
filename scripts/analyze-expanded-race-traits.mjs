/**
 * Prints automatic advantage/disadvantage ids referenced by races JSON but missing from codex data.
 * Usage: node scripts/analyze-expanded-race-traits.mjs path/to/races_expanded_wdh_english.json
 */
import fs from "node:fs";

const racesPath =
  process.argv[2] || "E:/Temp/downloads/races_expanded_wdh_english.json";

const disadvantages = JSON.parse(
  fs.readFileSync("./data/character/disadvantages.json", "utf8"),
);
const advantages = JSON.parse(
  fs.readFileSync("./data/character/advantages.json", "utf8"),
);
const did = new Set(disadvantages.disadvantages.map((x) => x.id));
const aid = new Set(advantages.advantages.map((x) => x.id));
const racesDoc = JSON.parse(fs.readFileSync(racesPath, "utf8"));

const missingAdv = [];
const missingDis = [];

for (const r of racesDoc.races) {
  for (const row of r.automatic_advantages ?? []) {
    if (row?.id && !aid.has(row.id))
      missingAdv.push({ race: r.id, id: row.id });
  }
  for (const row of r.automatic_disadvantages ?? []) {
    const alts = row?.pick_one_disadvantages;
    if (Array.isArray(alts)) {
      for (const o of alts)
        if (o?.id && !did.has(o.id))
          missingDis.push({ race: r.id, id: o.id, via: "pick_one" });
    }
    if (row?.id && !did.has(row.id))
      missingDis.push({ race: r.id, id: row.id, via: "direct" });
  }
}

console.warn("missing automatic advantages:");
console.warn([...new Set(missingAdv.map((x) => `${x.race}->${x.id}`))]);
console.warn("missing automatic disadvantages:");
console.warn([...new Set(missingDis.map((x) => `${x.race}->${x.id} (${x.via})`))]);
