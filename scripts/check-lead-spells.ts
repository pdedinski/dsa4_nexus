import kulturen from "../lib/chargen/data/kulturen.json";
import professionen from "../lib/chargen/data/professionen.json";
import rassen from "../lib/chargen/data/rassen.json";
import {
  applyFixedBausteine,
  leadSpellPickCount,
  packageAutoLeadSpellIds,
  packageHouseSpellIds,
} from "../lib/chargen/rules/applyBausteine";
import { emptyHeld } from "../lib/chargen/types";

const race = rassen.find((r) => r.id === "Rasse.Elfen")!;
const culture = kulturen.find((c) => c.id === "Kultur.Auelfen")!;
const profession = professionen.find(
  (p) => p.id === "Profession.Legendensaenger"
)!;

console.log("pick count", leadSpellPickCount(culture));
let held = emptyHeld();
held.raceId = race.id;
held.cultureId = culture.id;
held.professionId = profession.id;
held = applyFixedBausteine(held, race, culture, profession, {});
console.log(
  "spells",
  held.spells.length,
  held.spells.map((s) => `${s.id}:${s.sp}`).join(", ")
);
console.log(
  "auto leads",
  packageAutoLeadSpellIds(
    culture,
    profession,
    held.advantagesDisadvantages
  ).length
);
console.log("house", packageHouseSpellIds(culture, profession).length);
console.log("leadSpells", held.leadSpells.length);
console.log(
  "Weltsicht",
  held.advantagesDisadvantages.some(
    (t) => t.id === "VorNachteil.ElfischeWeltsicht"
  )
);
console.log(
  "Rep",
  held.specialAbilities.find((s) => s.id === "Sonderfertigkeit.Repraesentation")
);
held = applyFixedBausteine(held, race, culture, profession, {
  leadSpellPicks: [
    "Zauber.AbvenenumReineSpeise",
    "Zauber.Tiergedanken",
    "Zauber.Atemnot",
  ],
});
console.log("after picks total leads", held.leadSpells.length);
console.log(
  "includes picks",
  ["Zauber.AbvenenumReineSpeise", "Zauber.Tiergedanken", "Zauber.Atemnot"].every(
    (id) => held.leadSpells.includes(id)
  )
);
