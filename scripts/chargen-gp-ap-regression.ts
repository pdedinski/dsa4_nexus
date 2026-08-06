/**
 * One-off GP/AP formula regression checks against Java Chargen rules.
 * Run: npx tsx scripts/chargen-gp-ap-regression.ts
 */
import { resolveProfessionGpCost } from "../lib/chargen/rules/budget";
import {
  estimateTraitGp,
  traitGpDelta,
} from "../lib/chargen/rules/traitLabels";
import { emptyHeld } from "../lib/chargen/types";
import {
  specializationApCost,
  specializationGpCost,
  specialAbilityCostFactor,
} from "../lib/chargen/rules/expandSpecialAbilities";
import {
  resolveTalentSktColumn,
  languageRaiseApMultiplier,
} from "../lib/chargen/rules/sktColumn";
import {
  educatedApSavings,
} from "../lib/chargen/rules/budgetExtras";
import { sktFactor } from "../lib/chargen/rules/kosten";
import type { ExpandedSpecialAbility } from "../lib/chargen/rules/expandSpecialAbilities";
import type { CatalogItem } from "../lib/chargen/data/loadCatalog";

const asserts: { name: string; actual: unknown; expected: unknown; ok: boolean }[] = [];

function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  asserts.push({ name, actual, expected, ok });
  console.log(
    `${ok ? "OK" : "FAIL"}: ${name} => ${String(actual)}${
      ok ? "" : ` (expected ${String(expected)})`
    }`
  );
}

// 1. Magician profession GP
check(
  "Mage default GP",
  resolveProfessionGpCost(
    {
      id: "Profession.Magier",
      gp_cost: 18,
      gp_cost_by_race: { "Rasse.Halbelfen": 16 },
    } as CatalogItem,
    "Rasse.Mittellaender"
  ),
  18
);
check(
  "Mage Half-Elf GP",
  resolveProfessionGpCost(
    {
      id: "Profession.Magier",
      gp_cost: 18,
      gp_cost_by_race: { "Rasse.Halbelfen": 16 },
    } as CatalogItem,
    "Rasse.Halbelfen"
  ),
  16
);

const talents = [
  { id: "Talent.Sabel", group: "combat" },
  { id: "Talent.Zechen", group: "physical" },
  { id: "Talent.Magiekunde", group: "knowledge" },
] as CatalogItem[];

check(
  "Begabung combat",
  estimateTraitGp(
    { kosten_key: "BEGABUNG_TALENT" },
    null,
    { talents, variant: "Talent.Sabel" }
  ),
  6
);
check(
  "Begabung Zechen",
  estimateTraitGp(
    { kosten_key: "BEGABUNG_TALENT" },
    null,
    { talents, variant: "Talent.Zechen" }
  ),
  4
);
check(
  "Unfaehigkeit combat",
  estimateTraitGp(
    { kosten_key: "UNFAEHIGKEIT_TALENT" },
    null,
    { talents, variant: "Talent.Sabel" }
  ),
  -2
);
check(
  "Begabung gruppe fernkampf",
  estimateTraitGp(
    { kosten_key: "BEGABUNG_TALENTGRUPPE" },
    null,
    { variant: "fernkampf" }
  ),
  15
);
check(
  "Unfaehigkeit gruppe languages",
  estimateTraitGp(
    { kosten_key: "UNFAEHIGKEIT_TALENTGRUPPE" },
    null,
    { variant: "languages" }
  ),
  -7
);

let held = emptyHeld();
held.raceId = "Rasse.Elfen";
check(
  "GutesGedaechtnis elf",
  estimateTraitGp({ kosten_key: "GUTES_GEDAECHTNIS" }, null, { held }),
  12
);
held = emptyHeld();
check(
  "GutesGedaechtnis other",
  estimateTraitGp({ kosten_key: "GUTES_GEDAECHTNIS" }, null, { held }),
  7
);

held = emptyHeld();
held.advantagesDisadvantages = [{ id: "VorNachteil.Vollzauberer" }];
check(
  "AstralerBlock full",
  estimateTraitGp({ kosten_key: "ASTRALER_BLOCK" }, null, { held }),
  -10
);
held.advantagesDisadvantages = [];
check(
  "AstralerBlock quarter",
  estimateTraitGp({ kosten_key: "ASTRALER_BLOCK" }, null, { held }),
  -5
);

held = emptyHeld();
held.advantagesDisadvantages = [{ id: "VorNachteil.AdligeAbstammung" }];
check(
  "BesondererBesitz noble",
  estimateTraitGp({ kosten_key: "BESONDERER_BESITZ" }, null, { held }),
  3
);

check(
  "Verbindungen delta 8-5",
  traitGpDelta({ kosten_key: "VERBINDUNGEN" }, 8, 5, { held: emptyHeld() }),
  1
);
check(
  "Herausragende delta 2-1",
  traitGpDelta({ kosten_key: "HERAUSRAGENDE_EIGENSCHAFT" }, 2, 1),
  10
);

held = emptyHeld();
held.attributes = held.attributes.map((a) =>
  a.code === "SO" ? { ...a, base: 10 } : a
);
check("Albino SO10", estimateTraitGp({ kosten_key: "ALBINO" }, null, { held }), -4);

held = emptyHeld();
const specInst = {
  id: "Sonderfertigkeit.Talentspezialisierung",
  kosten_key: "TALENTSPEZIALISIERUNG",
  group: "talent_specialization",
  skt_column: 2,
  talent: "Talent.Magiekunde",
  instanceKey: "x",
  displayName: "Spec",
  variantMode: "none" as const,
  variantOptions: [],
  freeVariant: false,
} as ExpandedSpecialAbility;
check(
  "Spec AP col B",
  specializationApCost(held, specInst, "x"),
  Math.round(sktFactor(2) * 20 * 1)
);
check("Spec GP col B", specializationGpCost(held, specInst, "x"), 1);
held.discountedSpecialAbilities = ["Sonderfertigkeit.Talentspezialisierung"];
check(
  "Spec AP discounted",
  specializationApCost(held, specInst, "x"),
  Math.round(0.5 * sktFactor(2) * 20)
);
held.discountedSpecialAbilities = [];
held.advantagesDisadvantages = [{ id: "VorNachteil.ElfischeWeltsicht" }];
check("Factor elf", specialAbilityCostFactor(held, specInst), 1.5);

held = emptyHeld();
const sf = {
  id: "Sonderfertigkeit.Aufmerksamkeit",
  ap_cost: 200,
  group: "general",
  instanceKey: "y",
  displayName: "Attention",
  variantMode: "none" as const,
  variantOptions: [],
  freeVariant: false,
} as ExpandedSpecialAbility;
check("SF GP 200AP", Math.round(specializationApCost(held, sf) / 50), 4);

held = emptyHeld();
held.advantagesDisadvantages = [
  { id: "VorNachteil.AkademischeAusbildungKrieger" },
];
const sword = {
  id: "Talent.Sabel",
  group: "combat",
  combat: true,
  ranged: false,
  skt_column: 5,
} as CatalogItem;
check(
  "Krieger -2 creation",
  resolveTalentSktColumn(held, sword, { currentTp: 5 }),
  "C"
);

held = emptyHeld();
held.advantagesDisadvantages = [{ id: "VorNachteil.Schlangenmensch" }];
const ringen = {
  id: "Talent.Ringen",
  group: "combat",
  combat: true,
  ranged: false,
  skt_column: 3,
} as CatalogItem;
check(
  "Schlangenmensch Ringen",
  resolveTalentSktColumn(held, ringen, { currentTp: 0 }),
  "B"
);

held = emptyHeld();
held.advantagesDisadvantages = [{ id: "VorNachteil.GutesGedaechtnis" }];
const garethi = {
  id: "Talent.Garethi",
  group: "languages",
  language: true,
  skt_column: 1,
} as CatalogItem;
check("Good Memory lang mult", languageRaiseApMultiplier(held, garethi), 0.75);

held = emptyHeld();
held.advantagesDisadvantages = [{ id: "VorNachteil.Gebildet", rating: 2 }];
check("Educated savings", educatedApSavings(held), 80);

const failed = asserts.filter((a) => !a.ok);
console.log(`\n${asserts.length - failed.length}/${asserts.length} passed`);
if (failed.length) process.exit(1);
