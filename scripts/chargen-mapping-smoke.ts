/**
 * Quick smoke checks for Culture-Lore-class mapping / cost fixes.
 */
import { emptyHeld } from "../lib/chargen/types";
import { specializationApCost } from "../lib/chargen/rules/expandSpecialAbilities";
import { isForeignLanguage } from "../lib/chargen/rules/sktColumn";
import { unmetSpecialAbilityPrerequisites } from "../lib/chargen/rules/checkSpecialAbilityPrereqs";
import type { ExpandedSpecialAbility } from "../lib/chargen/rules/expandSpecialAbilities";

function check(name: string, got: unknown, want: unknown) {
  const ok = got === want;
  console.log(`${ok ? "OK" : "FAIL"}: ${name} => ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
  if (!ok) process.exitCode = 1;
}

const held = emptyHeld();
held.motherTongue = "Talent.Garethi";
held.secondLanguage = "Talent.Bosparano";
check("Bosparano not foreign", isForeignLanguage(held, "Talent.Bosparano"), false);
check("Thorwalsch foreign", isForeignLanguage(held, "Talent.Thorwalsch"), true);

const kk = {
  id: "Sonderfertigkeit.Kulturkunde",
  kosten_key: "KULTURKUNDE",
  ap_cost: 150,
  instanceKey: "x",
  displayName: "Culture Lore",
  variantMode: "list",
  variantOptions: [],
} as ExpandedSpecialAbility;
check("Kulturkunde AP", specializationApCost(held, kk), 150);
held.specialAbilities.push({ id: "Sonderfertigkeit.NandusgefaelligesWissen" });
check("Kulturkunde×Nandus", specializationApCost(held, kk), 75);

held.advantagesDisadvantages.push({ id: "VorNachteil.Balance" });
const sf = {
  id: "Sonderfertigkeit.Standfest",
  kosten_key: "AP_200_MIT_BALANCE",
  ap_cost: 200,
  instanceKey: "y",
  displayName: "Standfest",
  variantMode: "none",
  variantOptions: [],
} as ExpandedSpecialAbility;
check("Standfest+Balance", specializationApCost(held, sf), 0);

const held2 = emptyHeld();
const fails = unmetSpecialAbilityPrerequisites(held2, {
  id: "Sonderfertigkeit.AstraleMeditation",
  prerequisites: ["Z"],
  name: "x",
} as never);
check("Z missing trait", fails.length > 0, true);
check(
  "Z message not Sonderfertigkeit.Z",
  fails[0]?.message.includes("Sonderfertigkeit") ?? true,
  false
);
held2.advantagesDisadvantages.push({ id: "VorNachteil.Vollzauberer" });
check(
  "Z with Vollzauberer",
  unmetSpecialAbilityPrerequisites(held2, {
    id: "Sonderfertigkeit.AstraleMeditation",
    prerequisites: ["Z"],
    name: "x",
  } as never).length,
  0
);

const ort = {
  id: "Sonderfertigkeit.Ortskenntnis",
  kosten_key: "ORTSKENNTNIS",
  ap_cost: 150,
  instanceKey: "o",
  displayName: "O",
  variantMode: "free_text",
  variantOptions: [],
} as ExpandedSpecialAbility;
const h3 = emptyHeld();
check("Orts first", specializationApCost(h3, ort, "Town A"), 150);
h3.specialAbilities.push({
  id: "Sonderfertigkeit.Ortskenntnis",
  variant: "Town A",
});
check("Orts second", specializationApCost(h3, ort, "Town B"), 100);

if (!process.exitCode) console.log("\nAll mapping smoke checks passed");
