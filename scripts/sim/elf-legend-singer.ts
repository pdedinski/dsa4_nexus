/**
 * Port-side parity simulation: Elves / Lea Elf / Legend Singer
 * through creation + veteran — mirrors Java HeadlessSim purchases.
 *
 * Run: npx tsx scripts/sim/elf-legend-singer.ts
 */

import { getBuiltinCatalog } from "@/lib/chargen/data/loadCatalog";
import {
  applyFixedBausteine,
  listOpenTalentBonuses,
  seededTalentIds,
  traitGpNet,
  leadSpellPickCount,
} from "@/lib/chargen/rules/applyBausteine";
import { buildAttributeMods } from "@/lib/chargen/rules/attributeMods";
import {
  applyCreationAttributeMinimums,
  computeBudget,
  resolveProfessionGpCost,
} from "@/lib/chargen/rules/budget";
import {
  specialAbilityGpSpent,
} from "@/lib/chargen/rules/budgetExtras";
import { recomputeDerived } from "@/lib/chargen/rules/derived";
import {
  expandSpecialAbilities,
  specializationApCost,
} from "@/lib/chargen/rules/expandSpecialAbilities";
import {
  activateTalent,
  raiseTalentTp,
} from "@/lib/chargen/rules/talentActivation";
import {
  activateSpell,
  raiseSpellSp,
} from "@/lib/chargen/rules/spellActivation";
import { estimateTraitGp } from "@/lib/chargen/rules/traitLabels";
import {
  finishCreation,
  addAp,
  apCredit,
} from "@/lib/chargen/rules/veteran";
import {
  emptyHeld,
  ATTR_CODES_WITH_SO,
  currentAttrValue,
  type HeldModel,
  type AttrCodeWithSo,
} from "@/lib/chargen/types";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";

const TALENT_PRIORITY = [
  "Talent.SagenLegenden",
  "Talent.Singen",
  "Talent.Ueberzeugen",
  "Talent.Musizieren",
  "Talent.Menschenkenntnis",
  "Talent.Tanzen",
  "Talent.Tulamidya",
  "Talent.Isdira",
  "Talent.Lehren",
  "Talent.Geschichtswissen",
];

const SPELL_PRIORITY = [
  "Zauber.BalsamSalabunde",
  "Zauber.Bannbaladin",
  "Zauber.SensibarEmpathicus",
];

const LEAD_SPELL_PICKS = [
  "Zauber.Attributo",
  "Zauber.BalsamSalabunde",
  "Zauber.FlimFlamFunkel",
];

const DUMP_TALENTS = [
  ...TALENT_PRIORITY,
  "Talent.Garethi",
  "Talent.Bogenbau",
  "Talent.StimmenImitieren",
  "Talent.IsdiraSchrift",
  "Talent.Etikette",
  "Talent.Reiten",
];

function byId(items: CatalogItem[], id: string): CatalogItem {
  const found = items.find((i) => i.id === id);
  if (!found) throw new Error(`Missing catalog item: ${id}`);
  return found;
}

function log(...args: unknown[]) {
  console.log(...args);
}

function dumpAttrs(held: HeldModel, mods: ReturnType<typeof buildAttributeMods>) {
  for (const code of ATTR_CODES_WITH_SO) {
    const row = held.attributes.find((a) => a.code === code)!;
    log(
      `ATTR Eigenschaft.${attrGerman(code)} base=${row.base} zukauf=${row.purchased} final=${currentAttrValue(held, code, mods)}`
    );
  }
}

function attrGerman(code: AttrCodeWithSo): string {
  const map: Record<AttrCodeWithSo, string> = {
    CO: "Mut",
    CL: "Klugheit",
    IN: "Intuition",
    CH: "Charisma",
    DE: "Fingerfertigkeit",
    AG: "Gewandtheit",
    CN: "Konstitution",
    ST: "Koerperkraft",
    SO: "Sozialstatus",
  };
  return map[code];
}

function dumpTalents(held: HeldModel) {
  for (const id of DUMP_TALENTS) {
    const t = held.talents.find((x) => x.id === id);
    if (t) {
      log(`TALENT ${id} tp=${t.tp} lead=${held.leadTalents.includes(id)}`);
    } else {
      log(`TALENT ${id} tp=MISSING`);
    }
  }
}

function dumpSpells(held: HeldModel) {
  for (const id of SPELL_PRIORITY) {
    const s = held.spells.find((x) => x.id === id);
    if (s) {
      log(`SPELL ${id} sp=${s.sp} lead=${held.leadSpells.includes(id)}`);
    } else {
      log(`SPELL ${id} sp=MISSING`);
    }
  }
}

function setBase(held: HeldModel, code: AttrCodeWithSo, base: number): HeldModel {
  return {
    ...held,
    attributes: held.attributes.map((a) =>
      a.code === code ? { ...a, base } : a
    ),
  };
}

function main() {
  const races = getBuiltinCatalog("races");
  const cultures = getBuiltinCatalog("cultures");
  const professions = getBuiltinCatalog("professions");
  const talents = getBuiltinCatalog("talents");
  const spells = getBuiltinCatalog("spells");
  const traits = getBuiltinCatalog("advantages_disadvantages");
  const specials = getBuiltinCatalog("special_abilities");

  const race = byId(races, "Rasse.Elfen");
  const culture = byId(cultures, "Kultur.Auelfen");
  const profession = byId(professions, "Profession.Legendensaenger");

  log("=== PORT CHARGEN PARITY SIM ===");
  log("Build: Elves / Lea Elf / Legend Singer");
  log();

  // Open picks (must match Java harness)
  const openAssignments: Record<string, string[]> = {
    "culture-fixed-0": ["Talent.Tulamidya"], // Fremdsprachen +4
    "culture-fixed-1": ["Talent.Bogenbau"],
    "profession-fixed-0": ["Talent.StimmenImitieren"],
    "profession-fixed-1": ["Talent.Garethi"], // Fremdsprachen +6
    "profession-fixed-2": ["Talent.IsdiraSchrift"],
  };
  const openTraitPicks = {
    "race-vn-0": "VorNachteil.HerausragendesGehoer",
  };

  const leadCount = leadSpellPickCount(culture);
  log(`LEAD_SPELL_SLOTS_FROM_DATA=${leadCount}`);
  log(`LEAD_SPELL_PICKS_FORCED=${LEAD_SPELL_PICKS.join(",")}`);
  log("OPEN_TALENT_CHOICES:");
  for (const c of listOpenTalentBonuses(race, culture, profession)) {
    log(`  ${c.key} ranks=${JSON.stringify(c.ranks)} talents=${JSON.stringify(c.talents)}`);
  }

  let held = emptyHeld();
  held = {
    ...held,
    raceId: race.id,
    cultureId: culture.id,
    professionId: profession.id,
  };

  held = applyFixedBausteine(held, race, culture, profession, {
    openAssignments,
    openTraitPicks,
    leadSpellPicks: LEAD_SPELL_PICKS,
  });
  held = applyCreationAttributeMinimums(held, race, profession, culture);

  const attributeMods = buildAttributeMods(race, culture, profession);
  recomputeDerived(held, {
    attributeMods,
    race: (race.derived_modifiers as Record<string, number>) || {},
    culture: (culture.derived_modifiers as Record<string, number>) || {},
    profession: (profession.derived_modifiers as Record<string, number>) || {},
  });

  // Plan attribute bases
  log();
  log("--- SET ATTRIBUTE BASES ---");
  const bases: Record<AttrCodeWithSo, number> = {
    CO: 8,
    CL: 11,
    IN: 12,
    CH: 13,
    DE: 8,
    AG: 8,
    CN: 8,
    ST: 8,
    SO: 3,
  };
  for (const code of ATTR_CODES_WITH_SO) {
    held = setBase(held, code, bases[code]);
    log(
      `ATTR_BASE Eigenschaft.${attrGerman(code)} base=${bases[code]} final=${currentAttrValue(held, code, attributeMods)}`
    );
  }
  recomputeDerived(held, {
    attributeMods,
    race: (race.derived_modifiers as Record<string, number>) || {},
    culture: (culture.derived_modifiers as Record<string, number>) || {},
    profession: (profession.derived_modifiers as Record<string, number>) || {},
  });

  const expandedSpecials = expandSpecialAbilities(specials, talents);
  const raceGp = Number(race.gp_cost ?? 0);
  const cultureGp = Number(culture.gp_cost ?? 0);
  const professionGp = resolveProfessionGpCost(profession, race.id);

  const budgetOpts = () => ({
    raceGp,
    cultureGp,
    professionGp,
    traitGpNet: traitGpNet(held, traits, talents),
    specialAbilityGp: specialAbilityGpSpent(held, expandedSpecials),
    attributeMods,
    profession,
  });

  let budget = computeBudget(held, budgetOpts());
  log();
  log("--- SNAPSHOT AFTER_SEED ---");
  log(`GP=${budget.gpRemaining} AP=${budget.apRemaining} apStart=${budget.apStart} apSpent=${held.apSpent}`);
  dumpTalents(held);
  dumpSpells(held);
  log(`SPELL_COUNT=${held.spells.length}`);
  log(`SF_COUNT=${held.specialAbilities.length}`);
  for (const sf of held.specialAbilities) {
    log(`SF_SEEDED ${sf.id}${sf.variant ? ` var=${sf.variant}` : ""}`);
  }
  for (const sp of held.spells) {
    log(`SPELL_SEEDED ${sp.id} zfw=${sp.sp}`);
  }
  log(`CULTURE_HAS_SPELL_BONUSES=${Array.isArray(culture.spell_bonuses) ? (culture.spell_bonuses as unknown[]).length : "MISSING"}`);
  log(`PROFESSION_HAS_SPELLS=${Array.isArray(profession.spells) ? (profession.spells as unknown[]).length : "MISSING"}`);
  log(`CULTURE_SF_BONUSES=${Array.isArray(culture.special_ability_bonuses) ? (culture.special_ability_bonuses as unknown[]).length : "MISSING"}`);
  log(`PROFESSION_SF_BONUSES=${Array.isArray(profession.special_ability_bonuses) ? (profession.special_ability_bonuses as unknown[]).length : "MISSING"}`);
  log(`LEAD_TALENTS=${JSON.stringify(held.leadTalents)}`);
  log(`LEAD_SPELLS=${JSON.stringify(held.leadSpells)}`);

  // GP optional advantages
  log();
  log("--- GP OPTIONAL ADVANTAGES ---");
  log(`GP_BEFORE_OPTIONAL=${budget.gpRemaining}`);

  const costGutes = estimateTraitGp(
    byId(traits, "VorNachteil.GutesGedaechtnis") as never,
    undefined,
    { held }
  );
  log(`COST_GUTES_GEDAECHTNIS=${costGutes}`);
  if (
    costGutes <= budget.gpRemaining &&
    !held.advantagesDisadvantages.some((t) => t.id === "VorNachteil.GutesGedaechtnis")
  ) {
    held = {
      ...held,
      advantagesDisadvantages: [
        ...held.advantagesDisadvantages,
        { id: "VorNachteil.GutesGedaechtnis" },
      ],
    };
    budget = computeBudget(held, budgetOpts());
    log(`BUY_TRAIT VorNachteil.GutesGedaechtnis gpCost=${costGutes} gpAfter=${budget.gpRemaining}`);
  } else {
    log(`SKIP_TRAIT VorNachteil.GutesGedaechtnis need=${costGutes} have=${budget.gpRemaining}`);
  }

  budget = computeBudget(held, budgetOpts());
  if (
    !held.advantagesDisadvantages.some((t) => t.id === "VorNachteil.Astralmacht") &&
    budget.gpRemaining > 0
  ) {
    let levels = Math.min(6, budget.gpRemaining);
    held = {
      ...held,
      advantagesDisadvantages: [
        ...held.advantagesDisadvantages,
        { id: "VorNachteil.Astralmacht", rating: levels },
      ],
    };
    budget = computeBudget(held, budgetOpts());
    // If overspent, reduce
    while (budget.gpRemaining < 0 && levels > 0) {
      levels--;
      held = {
        ...held,
        advantagesDisadvantages: held.advantagesDisadvantages.map((t) =>
          t.id === "VorNachteil.Astralmacht" ? { ...t, rating: levels } : t
        ),
      };
      budget = computeBudget(held, budgetOpts());
    }
    if (levels > 0) {
      log(
        `BUY_TRAIT VorNachteil.Astralmacht stufe=${levels} gpCost=${levels} gpAfter=${budget.gpRemaining}`
      );
    }
  }
  budget = computeBudget(held, budgetOpts());
  log(`GP_AFTER_OPTIONAL=${budget.gpRemaining}`);

  const seeded = seededTalentIds(race, culture, profession, {
    openAssignments,
  });

  // Creation AP spend
  log();
  log("--- CREATION AP SPEND ---");

  // Zaubermelodie
  {
    const sfInst = expandedSpecials.find(
      (s) => s.id === "Sonderfertigkeit.Zaubermelodie"
    );
    if (sfInst && !held.specialAbilities.some((s) => s.id === sfInst.id)) {
      const cost = specializationApCost(held, sfInst);
      budget = computeBudget(held, budgetOpts());
      log(
        `COST_ZAUBERMELODIE=${cost} have=${budget.apRemaining} verbilligt=${held.discountedSpecialAbilities.includes(sfInst.id)}`
      );
      if (cost <= budget.apRemaining) {
        held = {
          ...held,
          specialAbilities: [
            ...held.specialAbilities,
            { id: sfInst.id, payment: "ap" },
          ],
          apSpent: held.apSpent + cost,
        };
        budget = computeBudget(held, budgetOpts());
        log(
          `BUY_SF Sonderfertigkeit.Zaubermelodie apCost=${cost} apAfter=${budget.apRemaining}`
        );
      } else {
        log("SKIP_SF Sonderfertigkeit.Zaubermelodie");
      }
    }
  }

  let progress = true;
  let guard = 0;
  while (progress && guard++ < 500) {
    progress = false;
    budget = computeBudget(held, budgetOpts());
    for (const tid of TALENT_PRIORITY) {
      const talent = byId(talents, tid);
      const row = held.talents.find((t) => t.id === tid);
      if (!row || !row.activated) {
        const before = held.apSpent;
        const next = activateTalent(held, talent, seeded);
        const cost = next.apSpent - before;
        const nextBudget = computeBudget(next, {
          ...budgetOpts(),
          // apSpent already on next
        });
        // recompute with next held
        const tmpHeld = next;
        const b2 = computeBudget(tmpHeld, {
          raceGp,
          cultureGp,
          professionGp,
          traitGpNet: traitGpNet(tmpHeld, traits, talents),
          specialAbilityGp: specialAbilityGpSpent(tmpHeld, expandedSpecials),
          attributeMods,
          profession,
        });
        if (b2.apRemaining < 0) continue;
        held = next;
        if (cost > 0) {
          log(
            `ACTIVATE_TALENT ${tid} apCost=${cost} apAfter=${b2.apRemaining}`
          );
        }
        // fall through to try raise
      }
      const before = held.apSpent;
      const from = held.talents.find((t) => t.id === tid)?.tp ?? 0;
      const raised = raiseTalentTp(held, talent, seeded);
      const cost = raised.apSpent - before;
      const b2 = computeBudget(raised, {
        raceGp,
        cultureGp,
        professionGp,
        traitGpNet: traitGpNet(raised, traits, talents),
        specialAbilityGp: specialAbilityGpSpent(raised, expandedSpecials),
        attributeMods,
        profession,
      });
      if (b2.apRemaining < 0 || cost <= 0 && raised.talents.find((t) => t.id === tid)?.tp === from) {
        continue;
      }
      const to = raised.talents.find((t) => t.id === tid)!.tp;
      held = raised;
      log(
        `RAISE_TALENT ${tid} ${from}->${to} apCost=${cost} apAfter=${b2.apRemaining}`
      );
      progress = true;
      break;
    }
    if (progress) continue;

    for (const sid of SPELL_PRIORITY) {
      const spell = byId(spells, sid);
      let row = held.spells.find((s) => s.id === sid);
      if (!row) {
        const before = held.apSpent;
        const next = activateSpell(held, spell);
        const cost = next.apSpent - before;
        const b2 = computeBudget(next, {
          raceGp,
          cultureGp,
          professionGp,
          traitGpNet: traitGpNet(next, traits, talents),
          specialAbilityGp: specialAbilityGpSpent(next, expandedSpecials),
          attributeMods,
          profession,
        });
        if (b2.apRemaining < 0) continue;
        held = next;
        log(
          `ACTIVATE_SPELL ${sid} apCost=${cost} apAfter=${b2.apRemaining}`
        );
        row = held.spells.find((s) => s.id === sid);
      }
      const before = held.apSpent;
      const from = row!.sp;
      const raised = raiseSpellSp(held, spell);
      const cost = raised.apSpent - before;
      const b2 = computeBudget(raised, {
        raceGp,
        cultureGp,
        professionGp,
        traitGpNet: traitGpNet(raised, traits, talents),
        specialAbilityGp: specialAbilityGpSpent(raised, expandedSpecials),
        attributeMods,
        profession,
      });
      if (b2.apRemaining < 0 || cost <= 0) continue;
      const to = raised.spells.find((s) => s.id === sid)!.sp;
      held = raised;
      log(
        `RAISE_SPELL ${sid} ${from}->${to} apCost=${cost} apAfter=${b2.apRemaining}`
      );
      progress = true;
      break;
    }
  }

  budget = computeBudget(held, budgetOpts());
  log();
  log(
    `CREATION_FINAL gpRemaining=${budget.gpRemaining} apRemaining=${budget.apRemaining}`
  );
  log(
    `CREATION_FINAL apStartApprox=${budget.apStart} apSpent=${held.apSpent}`
  );
  dumpAttrs(held, attributeMods);
  dumpTalents(held);
  dumpSpells(held);

  // Finish → veteran
  held = finishCreation(held, attributeMods, budget.gpRemaining);
  log();
  log("--- VETERAN PHASE ---");
  log(
    `VETERAN_START apTotal=${held.apTotal} apSpent=${held.apSpent} apGuthaben=${apCredit(held)}`
  );

  const addAmount = 1000;
  held = addAp(held, addAmount);
  log(
    `VETERAN_ADD_AP amount=${addAmount} apGuthaben=${apCredit(held)}`
  );

  log();
  log("--- VETERAN SPEND ---");
  // +1000 AP is spent on talents and spells only (no attribute zukauf)

  // Activate Etikette, Reiten
  for (const tid of ["Talent.Etikette", "Talent.Reiten"]) {
    const talent = byId(talents, tid);
    if (!held.talents.some((t) => t.id === tid && t.activated)) {
      const before = held.apSpent;
      held = activateTalent(held, talent, seeded);
      const cost = held.apSpent - before;
      log(
        `VET_ACTIVATE_TALENT ${tid} apCost=${cost} apAfter=${apCredit(held)} stufe=${held.talents.find((t) => t.id === tid)?.tp ?? 0}`
      );
    }
  }

  progress = true;
  guard = 0;
  while (progress && guard++ < 500) {
    progress = false;
    for (const tid of TALENT_PRIORITY) {
      const talent = byId(talents, tid);
      if (!held.talents.some((t) => t.id === tid)) continue;
      const before = held.apSpent;
      const from = held.talents.find((t) => t.id === tid)!.tp;
      const raised = raiseTalentTp(held, talent, seeded);
      const cost = raised.apSpent - before;
      if (apCredit(raised) < 0 || cost <= 0) continue;
      held = raised;
      log(
        `VET_RAISE_TALENT ${tid} ${from}->${held.talents.find((t) => t.id === tid)!.tp} apCost=${cost} apAfter=${apCredit(held)}`
      );
      progress = true;
      break;
    }
    if (progress) continue;
    for (const sid of SPELL_PRIORITY) {
      const spell = byId(spells, sid);
      if (!held.spells.some((s) => s.id === sid)) continue;
      const before = held.apSpent;
      const from = held.spells.find((s) => s.id === sid)!.sp;
      const raised = raiseSpellSp(held, spell);
      const cost = raised.apSpent - before;
      if (apCredit(raised) < 0 || cost <= 0) continue;
      held = raised;
      log(
        `VET_RAISE_SPELL ${sid} ${from}->${held.spells.find((s) => s.id === sid)!.sp} apCost=${cost} apAfter=${apCredit(held)}`
      );
      progress = true;
      break;
    }
  }

  log();
  log(
    `VETERAN_FINAL apTotal=${held.apTotal} apSpent=${held.apSpent} apGuthaben=${apCredit(held)}`
  );
  dumpAttrs(held, attributeMods);
  dumpTalents(held);
  dumpSpells(held);
  log(
    `HAS_ETIKETTE=${held.talents.some((t) => t.id === "Talent.Etikette")} stufe=${held.talents.find((t) => t.id === "Talent.Etikette")?.tp ?? -1}`
  );
  log(
    `HAS_REITEN=${held.talents.some((t) => t.id === "Talent.Reiten")} stufe=${held.talents.find((t) => t.id === "Talent.Reiten")?.tp ?? -1}`
  );
  log(
    `HAS_ZAUBERMELODIE=${held.specialAbilities.some((s) => s.id === "Sonderfertigkeit.Zaubermelodie")}`
  );
  log(
    `HAS_GUTES_GEDAECHTNIS=${held.advantagesDisadvantages.some((t) => t.id === "VorNachteil.GutesGedaechtnis")}`
  );
  const astral = held.advantagesDisadvantages.find(
    (t) => t.id === "VorNachteil.Astralmacht"
  );
  log(
    `HAS_ASTRALMACHT=${!!astral}${astral ? ` stufe=${astral.rating}` : ""}`
  );
  log(
    `HAS_HERAUSRAGENDES_GEHOER=${held.advantagesDisadvantages.some((t) => t.id === "VorNachteil.HerausragendesGehoer")}`
  );
  log(`LEAD_SPELLS=${JSON.stringify(held.leadSpells)}`);
  log(`LEAD_TALENTS_COUNT=${held.leadTalents.length}`);
  log("=== END PORT ===");
}

main();
