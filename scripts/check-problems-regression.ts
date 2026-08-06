import { emptyHeld } from "../lib/chargen/types";
import { checkBausteinAttributeRequirements } from "../lib/chargen/rules/voraussetzungen";
import {
  talentHoechststufe,
  checkTalentLevelCaps,
} from "../lib/chargen/rules/talentCaps";
import talents from "../lib/chargen/data/talente.json";
import type { CatalogItem } from "../lib/chargen/data/loadCatalog";

const talentList = talents as CatalogItem[];

let held = emptyHeld();
held.attributes = held.attributes.map((a) => ({
  ...a,
  base: a.code === "SO" ? 5 : 8,
}));
const pirate = {
  id: "Profession.Pirat",
  name: "Pirate",
  attribute_minimums: { CO: 12, AG: 12, CN: 11, ST: 11 },
  so_min: 1,
  so_max: 10,
};
const conflicts = checkBausteinAttributeRequirements(held, {
  profession: pirate,
});
console.log("Pirate mins (attrs at 8):");
for (const c of conflicts) console.log(" -", c.section, c.message);

const ori = talentList.find((t) => t.id === "Talent.Orientierung")!;
console.log("Orientierung test_attributes:", ori.test_attributes);
held.attributes = held.attributes.map((a) => ({
  ...a,
  base:
    a.code === "SO"
      ? 5
      : a.code === "CL" || a.code === "IN"
        ? 11
        : 10,
}));
console.log(
  "Orientierung cap at CL/IN 11:",
  talentHoechststufe(held, ori)
);
held.talents = [{ id: "Talent.Orientierung", tp: 5 }];
const caps = checkTalentLevelCaps(held, talentList);
console.log(
  "TP5 Orientation problems:",
  caps.length === 0 ? "none (correct)" : caps.map((c) => c.message)
);
