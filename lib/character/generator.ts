import racesData from "@/data/core/races.json";
import culturesData from "@/data/core/cultures.json";
import professionsData from "@/data/core/professions.json";
import spellsData from "@/data/magic/spells.json";
import disadvantagesData from "@/data/character/disadvantages.json";
import advantagesData from "@/data/character/advantages.json";
import advancementCosts from "@/data/meta/advancement_costs.json";
import cultureNames from "@/data/names/culture_names.json";
import armorData from "@/data/equipment/armor.json";
import specialAbilitiesData from "@/data/character/special_abilities.json";
import weaponsData from "@/data/equipment/weapons.json";
import { ALL_TALENT_IDS, TALENT_INDEX } from "@/lib/talents/catalog";
import { mergeTalentModifiersNormalized } from "@/lib/talents/modifierNormalization";
import {
  MANEUVER_ROOT_ALLOWLIST,
  saFitsWeaponLoadout,
} from "@/lib/character/maneuverLoadoutFit";
import {
  collectPackageSpells,
  cultureHasElvishWorldView,
  cultureLeadSpellCount,
  effectiveSpellColumn,
  ELF_KIND_PROFESSION_RACE_IDS,
  getSpellDef,
  isOwnRepresentationForSpell,
  lookupCulture,
  lookupProfession,
  resolveSpellCasterRole,
  resolveSpellCatalogId,
  satisfiesProfessionRaceRequirement,
  spellApplicable,
  type SpellCasterRole,
} from "@/lib/character/generationPackages";
import {
  computeGroundSpeed,
  rollRaceAgeYears,
  rollRaceAppearance,
} from "@/lib/character/generationAppearance";

import {
  spellActivationCost,
  spellAdvancementStepCost,
  talentActivationCost,
  talentStepsCost,
} from "./advancement";
import type {
  AttrCode,
  CharacterSheet,
  GenerateCharacterInput,
  SheetLoadout,
  SheetLoadoutArmor,
  SheetLoadoutWeapon,
  SpecialAbilityInstance,
  SpellPriority,
} from "./types";
import {
  groupOrdinalSlices,
  sortBandsByFrom,
  loadBundledDefaultApProfile,
} from "./apProfiles";
import { ATTR_CODES } from "./types";
import {
  allocateMeleeCombatTp,
  meleeBiasForTalentFromWeapons,
  normalizeConceptAtPaBias,
  type WeaponBiasRow,
} from "./meleeTpAllocation";

const SPELL_DEF_BY_ID = new Map(
  spellsData.spells.map(
    (s): [string, (typeof spellsData.spells)[number]] => [s.id, s],
  ),
);

const SA_BY_ID = new Map(
  specialAbilitiesData.special_abilities.map(
    (s): [string, (typeof specialAbilitiesData.special_abilities)[number]] => [
      s.id,
      s,
    ],
  ),
);

const ADVANTAGE_BY_ID = new Map(
  advantagesData.advantages.map(
    (a): [string, (typeof advantagesData.advantages)[number]] => [a.id, a],
  ),
);

const DISADVANTAGE_BY_ID = new Map(
  disadvantagesData.disadvantages.map(
    (d): [string, (typeof disadvantagesData.disadvantages)[number]] => [
      d.id,
      d,
    ],
  ),
);

/** Legacy / misparsed ids → catalog ids (advantages.json / disadvantages.json). */
const TRAIT_ID_ALIASES: Record<string, string> = {
  tough_as_nails: "tough_dog", // Zäher Hund — official English: Tough as Nails
};

function resolveTraitId(id: string): string {
  return TRAIT_ID_ALIASES[id] ?? id;
}

/**
 * Profession/race/culture SA ids that differ from special_abilities.json.
 * Prefer fixing data at source; this is a safety net for leftovers.
 */
const SA_ID_ALIASES: Record<string, string> = {
  evade_i: "dodge_i",
  evade_ii: "dodge_ii",
  evade_iii: "dodge_iii",
  feint: "feint_sa",
  blade_storm: "blade_storm_sa",
  called_attack: "called_attack_sa",
  double_attack: "double_attack_sa",
  stunning_blow: "stun_blow_sa",
  knowledge_of_a_place: "local_knowledge",
  aquatic_combat: "combat_in_water",
  knowledge_pleasing_to_nandus: "nandus_pleasing_knowledge",
  two_weapon_combat_ii: "ambidextrous_combat_ii",
  unarmed_combat_style_unau_school: "unarmed_style_unauer",
  combat_instinct: "combat_awareness",
};

function resolveSaId(id: string): string {
  return SA_ID_ALIASES[id] ?? id;
}

function enrichTraitInstance(
  raw: {
    id: string;
    name?: string;
    rating?: number;
    note?: string;
    pick_one_disadvantages?: CharacterSheet["automaticDisadvantages"][number]["pick_one_disadvantages"];
  },
  kind: "advantage" | "disadvantage",
): CharacterSheet["automaticAdvantages"][number] {
  const id = resolveTraitId(raw.id);
  const catalog =
    kind === "advantage"
      ? ADVANTAGE_BY_ID.get(id)
      : DISADVANTAGE_BY_ID.get(id);
  return {
    id,
    name: raw.name ?? catalog?.name,
    ...(raw.rating !== undefined ? { rating: raw.rating } : {}),
    ...(raw.note !== undefined ? { note: raw.note } : {}),
    ...(raw.pick_one_disadvantages
      ? { pick_one_disadvantages: raw.pick_one_disadvantages }
      : {}),
  };
}

const GP_START = 110;

/** Dwarfish stature (Zwerg / Angroschim-style packages). */
const DWARF_STATURE_RACE_IDS = new Set([
  "dwarf",
  "standard_dwarf",
  "brilliant_dwarf",
  "wild_dwarf",
]);

/** Rough height bands matching WdH text where we do not parse `height_formula`. */
function approximateHeightCm(
  rng: () => number,
  raceId: string,
): { heightCm: number; weightOffsetKg: number } {
  if (DWARF_STATURE_RACE_IDS.has(raceId))
    return {
      heightCm: 128 + Math.floor(rng() * 13),
      weightOffsetKg: 80,
    };
  if (raceId === "goblin" || raceId === "goblin_woman")
    return {
      heightCm: 135 + Math.floor(rng() * 25),
      weightOffsetKg: 100,
    };
  if (raceId === "tocamuyac")
    return {
      heightCm: 142 + Math.floor(rng() * 16),
      weightOffsetKg: 110,
    };
  if (raceId === "trollzacker" || raceId === "rochshaz")
    return {
      heightCm: 178 + Math.floor(rng() * 25),
      weightOffsetKg: 95,
    };
  if (raceId === "ork" || raceId === "ork_woman" || raceId === "half_orc")
    return {
      heightCm: 168 + Math.floor(rng() * 28),
      weightOffsetKg: 95,
    };
  if (raceId === "forest_person")
    return {
      heightCm: 152 + Math.floor(rng() * 16),
      weightOffsetKg: 110,
    };
  if (raceId === "elf" || raceId === "forest_elf" || raceId === "firn_elf")
    return {
      heightCm: 168 + Math.floor(rng() * 40),
      weightOffsetKg: 120,
    };
  return {
    heightCm: 160 + Math.floor(rng() * 41),
    weightOffsetKg: 100,
  };
}

/** Re-exported for wizard race/profession filters. */
export { ELF_KIND_PROFESSION_RACE_IDS, satisfiesProfessionRaceRequirement };

function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

const SHIELD_WEAPON_IDS_FOR_LOADOUT = new Set([
  "buckler",
  "small_shield",
  "battle_shield",
  "thorwaler_shield",
  "great_shield",
  "leather_shield",
  "large_leather_shield",
]);

/** Parierwaffen without `combat_talent` still use Daggers for TP/display (WdS convention). */
function codexMeleeCombatTalentForSheet(
  w: (typeof weaponsData.weapons)[number],
): string | null {
  const t = w.combat_talent;
  if (t != null && String(t).trim() !== "") return String(t).trim();
  if ((w as { is_parrying_weapon?: boolean }).is_parrying_weapon === true)
    return "daggers";
  return null;
}

function resolveLoadout(input: GenerateCharacterInput): SheetLoadout | undefined {
  const weaponIdList = dedupeIds([
    ...(input.weaponIds ?? []),
    ...(input.primaryWeaponId ? [input.primaryWeaponId] : []),
  ]);
  const armorIdList = dedupeIds([
    ...(input.armorIds ?? []),
    ...(input.primaryArmorId ? [input.primaryArmorId] : []),
  ]);

  const weapons: SheetLoadoutWeapon[] = [];
  for (const id of weaponIdList) {
    const w = weaponsData.weapons.find((x) => x.id === id);
    if (!w) continue;
    weapons.push({
      id: w.id,
      name: w.name,
      combatTalent: codexMeleeCombatTalentForSheet(w),
      ...((w as { is_shield?: boolean }).is_shield === true ||
      SHIELD_WEAPON_IDS_FOR_LOADOUT.has(w.id)
        ? { isShield: true }
        : {}),
      damage: w.damage,
      ...(typeof (w as { tp_kk?: unknown }).tp_kk === "string" &&
      String((w as { tp_kk: string }).tp_kk).trim() !== ""
        ? { tpKk: String((w as { tp_kk: string }).tp_kk).trim() }
        : {}),
      atModifier: typeof w.at_modifier === "number" ? w.at_modifier : 0,
      paModifier: typeof w.pa_modifier === "number" ? w.pa_modifier : 0,
      iniModifier: typeof w.ini_modifier === "number" ? w.ini_modifier : 0,
    });
  }

  const armors: SheetLoadoutArmor[] = [];
  for (const id of armorIdList) {
    const a = armorData.armor.find((x) => x.id === id);
    if (!a) continue;
    armors.push({
      id: a.id,
      name: a.name,
      ar: typeof a.ar === "number" ? a.ar : 0,
      ec: typeof a.ec === "number" ? a.ec : 0,
      iniModifier: typeof a.ini_modifier === "number" ? a.ini_modifier : 0,
      category: typeof a.category === "string" ? a.category : undefined,
      ...(typeof (a as Record<string, unknown>).at_modifier === "number" ? { atModifier: (a as Record<string, unknown>).at_modifier as number } : {}),
      ...(typeof (a as Record<string, unknown>).pa_modifier === "number" ? { paModifier: (a as Record<string, unknown>).pa_modifier as number } : {}),
    });
  }

  if (weapons.length === 0 && armors.length === 0) return undefined;
  return {
    ...(weapons.length ? { weapons } : {}),
    ...(armors.length ? { armors } : {}),
  };
}

/** Weapon WM rows for melee TP split (same id order as loadout weapons). */
function collectWeaponBiasRows(input: GenerateCharacterInput): WeaponBiasRow[] {
  const weaponIdList = dedupeIds([
    ...(input.weaponIds ?? []),
    ...(input.primaryWeaponId ? [input.primaryWeaponId] : []),
  ]);
  const rows: WeaponBiasRow[] = [];
  for (const id of weaponIdList) {
    const w = weaponsData.weapons.find((x) => x.id === id);
    if (!w) continue;
    rows.push({
      combatTalent: codexMeleeCombatTalentForSheet(w),
      atModifier: typeof w.at_modifier === "number" ? w.at_modifier : 0,
      paModifier: typeof w.pa_modifier === "number" ? w.pa_modifier : 0,
    });
  }
  return rows;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

/** Concept file omits `languages_scripts`; give it a small default share. */
function talentGroupPriorWeight(
  group: string,
  groupWeights: Record<string, number> | undefined
): number {
  const w = groupWeights?.[group];
  if (typeof w === "number" && w > 0) return w;
  if (group === "languages_scripts") return 0.08;
  return 0.1;
}

const TALENT_BIAS_MIN = 1;
const TALENT_BIAS_MAX = 3.5;

/** Per-talent multipliers from profession weights (stacked on group weight). */
function normalizeTalentBias(
  raw: unknown
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out[id] = Math.min(TALENT_BIAS_MAX, Math.max(TALENT_BIAS_MIN, v));
  }
  return out;
}

const TALENT_AVOID_MIN = 0.06;
const TALENT_AVOID_MAX = 1;

/**
 * Optional per-profession downweights for TGP picks: multiply pick weight (after talent_bias).
 * Values in (0, 1]; ids must exist in TALENT_INDEX. Omitted talents use 1.
 */
function normalizeTalentAvoidBias(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!TALENT_INDEX.has(id)) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    out[id] = Math.min(TALENT_AVOID_MAX, Math.max(TALENT_AVOID_MIN, v));
  }
  return out;
}

/** Concept-driven relative weights for random advantage/disadvantage picks (≥0; default 1). */
function normalizeTraitPickBias(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
    out[id] = v;
  }
  return out;
}

function pickWeightedByIdBias<T extends { id: string }>(
  rng: () => number,
  items: T[],
  bias: Record<string, number>
): T {
  if (items.length === 1) return items[0]!;
  const ws = items.map((x) => {
    const b = bias[x.id];
    const mult = typeof b === "number" && b > 0 ? b : 1;
    return Math.max(0.02, mult * (0.55 + rng() * 0.9));
  });
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** Combat talents implied by chosen weapons, split by combat type (weapon focus). */
type WeaponTalentFocus = {
  melee: ReadonlySet<string>;
  ranged: ReadonlySet<string>;
};

function weaponTalentFocusFromLinked(
  linkedCombatIds: Set<string>,
): WeaponTalentFocus | null {
  if (linkedCombatIds.size === 0) return null;
  const melee = new Set<string>();
  const ranged = new Set<string>();
  for (const id of linkedCombatIds) {
    const def = TALENT_INDEX.get(id);
    if (!def || def.group !== "combat_talents") continue;
    const ct = def.combat_type;
    if (ct === "melee" || ct === "jousting") melee.add(id);
    else if (ct === "ranged") ranged.add(id);
  }
  if (melee.size === 0 && ranged.size === 0) return null;
  return { melee, ranged };
}

/**
 * Downweight for a combat talent whose weapon type is represented in the
 * loadout but the specific talent was not chosen (wrong sword family, etc.).
 */
const WEAPON_FOCUS_OFF_TYPE_FACTOR = 0.42;

/**
 * Downweight for a combat talent whose entire weapon type was NOT selected at
 * all (e.g. all ranged talents when the player only picked melee weapons, or
 * unarmed/brawling when only ranged weapons were chosen).
 * Applied on top of WEAPON_FOCUS_OFF_TYPE_FACTOR when both conditions hold.
 */
const WEAPON_FOCUS_UNSELECTED_TYPE_FACTOR = 0.28;

/** Positive boost for combat talents that match the wizard weapon loadout. */
const WEAPON_FOCUS_ON_TYPE_FACTOR = 2.2;

/**
 * Weight for one talent +1 TP step (same formula as {@link pickWeightedTalentForStep}).
 */
function talentStepPickWeight(
  rng: () => number,
  id: string,
  groupWeights: Record<string, number> | undefined,
  talentBias: Record<string, number> | undefined,
  talentAvoid: Record<string, number> | undefined,
  weaponFocus: WeaponTalentFocus | null,
): number {
  const bias = talentBias ?? {};
  const avoid = talentAvoid ?? {};
  const def = TALENT_INDEX.get(id);
  if (!def) return 0.05;
  const g = talentGroupPriorWeight(def.group, groupWeights);
  const b = bias[id] ?? 1;
  const av = avoid[id] ?? 1;
  let w = g * b * av * (0.55 + rng() * 0.9);
  if (weaponFocus && def.group === "combat_talents") {
    const isMelee = def.combat_type === "melee" || def.combat_type === "jousting";
    const isRanged = def.combat_type === "ranged";

    if (isMelee) {
      if (weaponFocus.melee.size === 0 && weaponFocus.ranged.size > 0) {
        w *= WEAPON_FOCUS_UNSELECTED_TYPE_FACTOR;
      } else if (weaponFocus.melee.size > 0 && !weaponFocus.melee.has(id)) {
        w *= WEAPON_FOCUS_OFF_TYPE_FACTOR;
      } else if (weaponFocus.melee.has(id)) {
        w *= WEAPON_FOCUS_ON_TYPE_FACTOR;
      }
    } else if (isRanged) {
      if (weaponFocus.ranged.size === 0 && weaponFocus.melee.size > 0) {
        w *= WEAPON_FOCUS_UNSELECTED_TYPE_FACTOR;
      } else if (weaponFocus.ranged.size > 0 && !weaponFocus.ranged.has(id)) {
        w *= WEAPON_FOCUS_OFF_TYPE_FACTOR;
      } else if (weaponFocus.ranged.has(id)) {
        w *= WEAPON_FOCUS_ON_TYPE_FACTOR;
      }
    }
  }
  return Math.max(0.05, w);
}

/**
 * Picks one talent to raise by +1 TP. Weight is group × talent_bias × talent_avoid × jitter.
 *
 * Weapon focus rules (both applied without using current TP):
 *  1. Off-weapon within a represented type  → ×WEAPON_FOCUS_OFF_TYPE_FACTOR
 *  2. Completely unrepresented weapon type  → ×WEAPON_FOCUS_UNSELECTED_TYPE_FACTOR
 *     (i.e. ranged when only melee weapons chosen, or vice-versa)
 */
function pickWeightedTalentForStep(
  rng: () => number,
  candidateIds: string[],
  groupWeights: Record<string, number> | undefined,
  talentBias: Record<string, number> | undefined,
  talentAvoid: Record<string, number> | undefined,
  weaponFocus: WeaponTalentFocus | null,
): string {
  if (candidateIds.length === 1) return candidateIds[0]!;
  const ws = candidateIds.map((id) =>
    talentStepPickWeight(
      rng,
      id,
      groupWeights,
      talentBias,
      talentAvoid,
      weaponFocus,
    ),
  );
  const total = ws.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidateIds.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return candidateIds[i]!;
  }
  return candidateIds[candidateIds.length - 1]!;
}

function collectWeaponLinkedCombatTalentIds(input: GenerateCharacterInput): Set<string> {
  const out = new Set<string>();
  const weaponIdList = dedupeIds([
    ...(input.weaponIds ?? []),
    ...(input.primaryWeaponId ? [input.primaryWeaponId] : []),
  ]);
  for (const wid of weaponIdList) {
    const w = weaponsData.weapons.find((x) => x.id === wid);
    if (!w) continue;
    const add = (tid: string | null | undefined) => {
      if (!tid) return;
      const def = TALENT_INDEX.get(tid);
      if (def?.group === "combat_talents") out.add(tid);
    };
    add(w.combat_talent ?? null);
    const sec = (w as { secondary_talents?: string[] }).secondary_talents;
    if (Array.isArray(sec)) for (const st of sec) add(st);
  }
  return out;
}

/**
 * BRW p.47 / ENG p.29: max starting TP = highest of the talent's three test attributes + 3.
 * Begabung (Aptitude) advantages raise the ceiling to +5 for the covered talent scope
 * (BRW p.44); single-talent aptitudes are not modeled without a chosen talent binding.
 */
function creationMaxTalentTp(
  def: NonNullable<ReturnType<typeof TALENT_INDEX.get>>,
  attrsFinal: CharacterSheet["attributesFinal"],
  advantageIds: ReadonlySet<string>
): number {
  const testA = (def.test_attributes ?? ["CL", "IN", "CH"]) as AttrCode[];
  const hi = Math.max(...testA.map((a) => attrsFinal[a] ?? 0), 0);
  let plus = 3;
  const ct = def.combat_type;
  if (advantageIds.has("aptitude_melee_talents") && (ct === "melee" || ct === "jousting")) {
    plus = 5;
  } else if (advantageIds.has("aptitude_ranged_talents") && ct === "ranged") {
    plus = 5;
  } else if (advantageIds.has("aptitude_talent_group_combat")) {
    if (def.group === "combat_talents" || def.group === "physical_talents") plus = 5;
  } else if (advantageIds.has("aptitude_talent_group_other")) {
    if (def.group !== "combat_talents" && def.group !== "physical_talents") plus = 5;
  }
  return hi + plus;
}

function clampTalentTpMapToCreationMax(
  talentTp: Map<string, number>,
  attrsFinal: CharacterSheet["attributesFinal"],
  advantageIds: ReadonlySet<string>
) {
  for (const [id, tp] of talentTp) {
    const def = TALENT_INDEX.get(id);
    if (!def) continue;
    const cap = creationMaxTalentTp(def, attrsFinal, advantageIds);
    if (tp > cap) talentTp.set(id, cap);
  }
}

/**
 * One legal TGP/AP spend on a talent: unknown basic = first step 0→1; unknown
 * specialized = activation to TP 0 (counts toward 5 activations); otherwise
 * one advancement step using the column table.
 */
const VETERAN_TP_SP_CAP = 18;

function computeTalentSpend(
  id: string,
  talentTp: Map<string, number>,
  cols: (typeof advancementCosts)["talent_columns"]["columns"],
  attrsFinal: CharacterSheet["attributesFinal"],
  activationsRemaining: number,
  budget: number,
  advantageIds: ReadonlySet<string>,
  capMode: "creation" | "veteran" = "creation",
): { cost: number; nextTp: number; usesNewActivation: boolean } | null {
  const def = TALENT_INDEX.get(id);
  if (!def?.advancement_column) return null;
  const col = def.advancement_column;
  const maxTp =
    capMode === "veteran"
      ? VETERAN_TP_SP_CAP
      : creationMaxTalentTp(def, attrsFinal, advantageIds);
  const tp = talentTp.get(id);

  if (tp === undefined) {
    if (def.is_basic) {
      if (maxTp < 1) return null;
      const cost = talentStepsCost(cols, col, 0, 1);
      if (cost <= 0 || cost > budget) return null;
      return { cost, nextTp: 1, usesNewActivation: false };
    }
    if (activationsRemaining <= 0) return null;
    const act = talentActivationCost(cols, col);
    if (act <= 0 || act > budget) return null;
    return { cost: act, nextTp: 0, usesNewActivation: true };
  }

  if (tp >= maxTp) return null;
  const cost = talentStepsCost(cols, col, tp, tp + 1);
  if (cost <= 0 || cost > budget) return null;
  return { cost, nextTp: tp + 1, usesNewActivation: false };
}

const WEAPON_LOADOUT_MIN_COMBAT_TALENT_TP = 3;

/**
 * Chosen weapons imply combat technique talents. Spend creation TGP (and
 * specialized activations when needed) so each linked talent reaches at least
 * {@link WEAPON_LOADOUT_MIN_COMBAT_TALENT_TP} before random TGP spending.
 * If that is impossible, throws with a user-facing message (API returns 400).
 */
function ensureWeaponCombatTalentsForLoadout(
  requiredTalentIds: ReadonlySet<string>,
  talentTp: Map<string, number>,
  cols: (typeof advancementCosts)["talent_columns"]["columns"],
  attrsFinal: CharacterSheet["attributesFinal"],
  advantageIds: ReadonlySet<string>,
  budget: { tgpLeft: number; activationsRemaining: number },
): void {
  if (requiredTalentIds.size === 0) return;

  const sorted = [...requiredTalentIds].sort();
  const minTp = WEAPON_LOADOUT_MIN_COMBAT_TALENT_TP;

  for (const id of sorted) {
    const def = TALENT_INDEX.get(id);
    if (!def || def.group !== "combat_talents") {
      throw new Error(
        `Cannot complete generation: a chosen weapon references unknown combat talent "${id}".`,
      );
    }
    const cap = creationMaxTalentTp(def, attrsFinal, advantageIds);
    if (cap < minTp) {
      throw new Error(
        `Cannot complete generation: your chosen weapons require "${def.name}" (${id}) at TP ${minTp}, but with this hero's attributes the creation maximum for that talent is only ${cap}.`,
      );
    }

    while ((talentTp.get(id) ?? -999) < minTp) {
      const spend = computeTalentSpend(
        id,
        talentTp,
        cols,
        attrsFinal,
        budget.activationsRemaining,
        budget.tgpLeft,
        advantageIds,
      );
      if (!spend) {
        const cur = talentTp.get(id);
        const curLabel =
          cur === undefined ? "not yet learned" : `currently TP ${cur}`;
        throw new Error(
          `Cannot complete generation: your chosen weapons require combat talent "${def.name}" (${id}) at least at TP ${minTp} (${curLabel}), but there are not enough creation resources left — ` +
            `${budget.tgpLeft} TGP remaining and ${budget.activationsRemaining} specialized activation(s) remaining. ` +
            `Choose weapons your profession or culture already covers, pick a build with more TGP, or free activations by reducing other new specialized talents.`,
        );
      }
      budget.tgpLeft -= spend.cost;
      if (spend.usesNewActivation) budget.activationsRemaining--;
      talentTp.set(id, spend.nextTp);
    }
  }
}

/** Languages/scripts need culture mother-tongue rules; omit from random pool. */
function buildTalentSpendPool(mergedIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of mergedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of ALL_TALENT_IDS) {
    if (seen.has(id)) continue;
    const d = TALENT_INDEX.get(id);
    if (!d || d.group === "languages_scripts") continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function raceAllowsCulture(race: (typeof racesData.races)[0], cultureId: string) {
  const allowed = race.allowed_cultures.flatMap((c) =>
    c === "novadis" ? (["novadis_men", "novadis_women"] as const) : [c]
  );
  return allowed.includes(cultureId);
}

function cultureAllowsProfession(
  culture: (typeof culturesData.cultures)[0],
  professionId: string
) {
  const list = culture.allowed_professions;
  return list.includes(professionId);
}

function isProfessionSelectable(
  profession: (typeof professionsData.professions)[number]
): boolean {
  return (profession as { selectable?: boolean }).selectable !== false;
}

function cultureAllowsRace(
  culture: (typeof culturesData.cultures)[0],
  raceId: string
) {
  return culture.allowed_races.includes(raceId);
}

function professionSoRange(
  profession: (typeof professionsData.professions)[0]
): { min: number; max: number } {
  const r = profession.requirements.find((x) => x.type === "SO_range") as
    | { min: number; max: number }
    | undefined;
  return r ? { min: r.min, max: r.max } : { min: 1, max: 13 };
}

/**
 * BRW p.42: SO costs 1 GP per point above the profession minimum and directly
 * determines starting money (SO × SO Silbertaler). Rolls within the profession's
 * legal SO range (slightly centre-weighted).
 */
function generateSo(
  rng: () => number,
  profRange: { min: number; max: number },
): number {
  const lo = profRange.min;
  const hi = profRange.max;
  if (lo >= hi) return lo;
  return Math.min(hi, Math.max(lo, Math.round(lo + rng() * (hi - lo))));
}

function professionAttrMins(
  profession: (typeof professionsData.professions)[0]
): Partial<Record<AttrCode, number>> {
  const out: Partial<Record<AttrCode, number>> = {};
  for (const req of profession.requirements) {
    if (
      req.type === "attr_min" &&
      "attr" in req &&
      "value" in req &&
      typeof req.value === "number"
    )
      out[req.attr as AttrCode] = Math.max(
        out[req.attr as AttrCode] ?? 0,
        req.value
      );
  }
  return out;
}

function applyAttrMods(
  base: Record<AttrCode, number>,
  race: (typeof racesData.races)[0],
  culture: (typeof culturesData.cultures)[0]
): Record<AttrCode, number> {
  const out = { ...base };
  const apply = (mod?: Record<string, number>) => {
    if (!mod) return;
    for (const [k, v] of Object.entries(mod)) {
      if (ATTR_CODES.includes(k as AttrCode))
        out[k as AttrCode] += v as number;
    }
  };
  apply(
    (race.attribute_modifiers ?? undefined) as Record<string, number> | undefined
  );
  apply(
    (culture.attribute_modifiers ?? undefined) as
      | Record<string, number>
      | undefined
  );
  return out;
}

/** Picks one attribute from `pool` with prob proportional to 2^bias[a] (profession-led but varied). */
function weightedPickAttr(
  rng: () => number,
  pool: AttrCode[],
  bias: Partial<Record<AttrCode, number>>
): AttrCode {
  const weights = pool.map((a) => Math.pow(2, bias[a] ?? 0));
  const total = weights.reduce((s, w) => s + w, 0);
  if (!(total > 0) || !Number.isFinite(total)) {
    const i = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    return pool[Math.max(0, i)]!;
  }
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function solveAttributes(
  rng: () => number,
  minsNeeded: Partial<Record<AttrCode, number>>,
  _bias: Partial<Record<AttrCode, number>>
): Record<AttrCode, number> {
  const base: Record<AttrCode, number> = {
    CO: 8,
    CL: 8,
    IN: 8,
    CH: 8,
    DE: 8,
    AG: 8,
    CN: 8,
    ST: 8,
  };
  for (const a of ATTR_CODES) {
    const need = minsNeeded[a] ?? 8;
    base[a] = Math.max(8, Math.min(14, need));
  }
  return base;
}

function raiseAttributesWithRemainingGp(
  rng: () => number,
  purchased: Record<AttrCode, number>,
  gp: number,
  bias: Partial<Record<AttrCode, number>>,
): { purchased: Record<AttrCode, number>; gp: number; attrSum: number } {
  let attrSum = ATTR_CODES.reduce((s, a) => s + purchased[a], 0);
  while (gp > 0 && attrSum < 100) {
    const pool = ATTR_CODES.filter((a) => purchased[a] < 14);
    if (pool.length === 0) break;
    const a = weightedPickAttr(rng, pool, bias);
    purchased[a]++;
    attrSum++;
    gp--;
  }
  return { purchased, gp, attrSum };
}

function disadvantageRefundGP(d: (typeof disadvantagesData.disadvantages)[0]): number {
  if (typeof d.gp_refund === "number") return Math.abs(d.gp_refund);
  return 0;
}

function isFullCaster(
  raceId: string,
  professionId: string,
  halfElfFullCaster: boolean
): boolean {
  if (professionId === "magician") return true;
  const profession = professionsData.professions.find((p) => p.id === professionId);
  if (
    profession &&
    "magical_status" in profession &&
    (profession as { magical_status?: string }).magical_status === "full_caster"
  ) {
    return true;
  }
  const row = racesData.races.find((r) => r.id === raceId);
  if (row?.magic_status === "full_caster") return true;
  if (raceId === "half_elf" && halfElfFullCaster) return true;
  return false;
}

/**
 * Maximum Spell Prowess from the spell's three test attributes.
 * Own representation: highest attribute + 3 (creation) or {@link VETERAN_TP_SP_CAP} (veteran).
 * Foreign representation: lowest attribute (no bonus).
 */
function calculateSpellMaxSp(
  spell: (typeof spellsData.spells)[0],
  attrsFinal: CharacterSheet["attributesFinal"],
  role: SpellCasterRole,
  capMode: "creation" | "veteran" = "creation",
): number {
  const testA = (spell.test_attributes ?? ["CL", "IN", "CH"]) as AttrCode[];
  const values = testA.map((a) => attrsFinal[a] ?? 0);
  if (values.length === 0) return 0;
  if (!isOwnRepresentationForSpell(spell, role)) return Math.min(...values);
  const creationCap = Math.max(...values) + 3;
  return capMode === "veteran" ? Math.max(creationCap, VETERAN_TP_SP_CAP) : creationCap;
}

function spellColumnFor(
  spell: (typeof spellsData.spells)[0],
  role: SpellCasterRole,
  houseIds: ReadonlySet<string>,
  leadIds: ReadonlySet<string>,
  elvishWorldView: boolean,
): string {
  return effectiveSpellColumn(spell, {
    role,
    isHouse: houseIds.has(spell.id),
    isLead: leadIds.has(spell.id),
    elvishWorldView,
  });
}

const TONGUE_BY_LANGUAGE: Record<string, string> = {
  tulamidya: "tongue_tulamidya",
  bosparano: "tongue_bosparano",
  thorwalian: "tongue_thorwalian",
  rogolan: "tongue_rogolan",
  garethi: "tongue_garethi",
  isdira: "tongue_isdira",
  orkish: "tongue_orkish",
  goblinic: "tongue_goblinic",
};

function applyCultureLanguages(
  culture: (typeof culturesData.cultures)[number],
  talentTp: Map<string, number>,
  cl: number,
) {
  const entries = (culture as { language_entries?: { type?: string; language?: string }[] })
    .language_entries;
  if (!Array.isArray(entries)) return;
  for (const e of entries) {
    const lang = (e.language ?? "").trim().toLowerCase();
    const talentId = TONGUE_BY_LANGUAGE[lang] ?? `tongue_${lang}`;
    if (!TALENT_INDEX.has(talentId)) continue;
    if (e.type === "mother_tongue") {
      talentTp.set(talentId, Math.max(talentTp.get(talentId) ?? 0, cl - 2));
    } else if (e.type === "second_language") {
      talentTp.set(talentId, Math.max(talentTp.get(talentId) ?? 0, cl - 4));
    }
  }
}

function professionForcesFemale(profession: (typeof professionsData.professions)[number]): boolean {
  if (profession.id === "amazon") return true;
  const notes = profession.requirements.filter(
    (r): r is { type: "gender_note"; note: string } => r.type === "gender_note",
  );
  const women = notes.some((n) => /women only/i.test(n.note));
  const men = notes.some((n) => /men only/i.test(n.note));
  return women && !men;
}

function resolveGenerationGender(
  input: GenerateCharacterInput,
  raceId: string,
  profession: (typeof professionsData.professions)[number],
  rng: () => number,
): "male" | "female" {
  if (professionForcesFemale(profession)) return "female";
  if (input.gender === "male" || input.gender === "female") return input.gender;
  return rng() < 0.5 ? "male" : "female";
}

function traitNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function collectUnsuitableTraitKeys(
  race: (typeof racesData.races)[number],
  culture: (typeof culturesData.cultures)[number],
  profession: (typeof professionsData.professions)[number],
): { ids: Set<string>; names: Set<string> } {
  const ids = new Set<string>();
  const names = new Set<string>();
  const addList = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (typeof item === "string") {
        ids.add(item);
        names.add(traitNameKey(item));
      }
    }
  };
  addList(race.unsuitable_advantages);
  addList(race.unsuitable_disadvantages);
  addList((culture as { unsuitable_advantages?: unknown }).unsuitable_advantages);
  addList((culture as { unsuitable_disadvantages?: unknown }).unsuitable_disadvantages);
  const uns = (profession as { unsuitable_traits?: { advantages?: string[]; disadvantages?: string[] } })
    .unsuitable_traits;
  addList(uns?.advantages);
  addList(uns?.disadvantages);
  return { ids, names };
}

/** Base weight for spell pick ordering; 0 = excluded unless fallback activates. */
function spellPriorityBase(p?: SpellPriority): number {
  if (p === "high") return 3;
  if (p === "medium") return 2;
  if (p === "low") return 1;
  return 0;
}

/** Priority multiplier for ZfW steps (SGP and veteran); "none" / unset uses 1. */
function spellVeteranPriorityWeight(p?: SpellPriority): number {
  const b = spellPriorityBase(p);
  return b > 0 ? b : 1;
}

/**
 * Pick weight for the next ZfW step on a spell (SGP or veteran). Uses
 * {@link spell_group_weight} × priority × jitter. Same formula for both pools.
 */
function spellStepPickWeight(
  priority: SpellPriority | undefined,
  groupFactor: number,
  rng: () => number,
): number {
  return (
    groupFactor * spellVeteranPriorityWeight(priority) * (0.55 + rng() * 0.9)
  );
}

/** True when armor step lists a shield or weapons loadout includes a shield. */
function inputIncludesShieldFromInput(input: GenerateCharacterInput): boolean {
  const armorIdList = dedupeIds([
    ...(input.armorIds ?? []),
    ...(input.primaryArmorId ? [input.primaryArmorId] : []),
  ]);
  for (const id of armorIdList) {
    const a = armorData.armor.find((x) => x.id === id);
    if (a && a.category === "shield") return true;
  }
  const weaponIdList = dedupeIds([
    ...(input.weaponIds ?? []),
    ...(input.primaryWeaponId ? [input.primaryWeaponId] : []),
  ]);
  for (const id of weaponIdList) {
    const w = weaponsData.weapons.find((x) => x.id === id);
    if (!w) continue;
    if ((w as { is_shield?: boolean }).is_shield === true) return true;
    if (w.combat_talent === "shields") return true;
    if (SHIELD_WEAPON_IDS_FOR_LOADOUT.has(w.id)) return true;
  }
  return false;
}

function inputIncludesParryingWeapon(input: GenerateCharacterInput): boolean {
  const weaponIdList = dedupeIds([
    ...(input.weaponIds ?? []),
    ...(input.primaryWeaponId ? [input.primaryWeaponId] : []),
  ]);
  for (const id of weaponIdList) {
    const w = weaponsData.weapons.find((x) => x.id === id);
    if (!w) continue;
    if ((w as { is_parrying_weapon?: boolean }).is_parrying_weapon === true) return true;
  }
  return false;
}

/** Note text for Armor Use I (category + piece name) from highest RS non-shield armor. */
function pickArmorUseOneNoteForInput(
  input: GenerateCharacterInput,
): string | null {
  const armorIdList = dedupeIds([
    ...(input.armorIds ?? []),
    ...(input.primaryArmorId ? [input.primaryArmorId] : []),
  ]);
  let best: {
    ar: number;
    id: string;
    category: string;
    name: string;
  } | null = null;
  for (const id of armorIdList) {
    const a = armorData.armor.find((x) => x.id === id);
    if (!a) continue;
    if (a.category === "shield") continue;
    const ar = typeof a.ar === "number" ? a.ar : 0;
    if (
      !best ||
      ar > best.ar ||
      (ar === best.ar && id.localeCompare(best.id) < 0)
    ) {
      best = {
        ar,
        id,
        category: typeof a.category === "string" ? a.category : "other",
        name: a.name,
      };
    }
  }
  if (!best) return null;
  return `${best.category.replace(/_/g, " ")} (${best.name})`;
}

/** One row per SA id: culture + profession often repeat the same automatic SA (e.g. Armor Use I). */
function dedupeSpecialAbilitiesById(
  list: SpecialAbilityInstance[],
): SpecialAbilityInstance[] {
  const out: SpecialAbilityInstance[] = [];
  const indexById = new Map<string, number>();
  for (const s of list) {
    const id = resolveSaId(s.id);
    const catalog = SA_BY_ID.get(id);
    const existingIdx = indexById.get(id);
    if (existingIdx === undefined) {
      indexById.set(id, out.length);
      out.push({
        id,
        name: s.name ?? catalog?.name,
        ...(s.note ? { note: s.note } : {}),
      });
    } else {
      const prev = out[existingIdx]!;
      const name = prev.name ?? s.name ?? catalog?.name;
      const noteParts = [prev.note, s.note].filter(
        (n): n is string => typeof n === "string" && n.trim() !== "",
      );
      const unique = [...new Set(noteParts.map((n) => n.trim()))];
      const note =
        unique.length === 0 ? undefined : unique.join("; ");
      out[existingIdx] = {
        id,
        ...(name ? { name } : {}),
        ...(note ? { note } : {}),
      };
    }
  }
  return out;
}

type SaApPurchaseOpts = {
  armorUseINote?: string;
  /** Optional trace for superuser debug mode. */
  dbg?: (line: string) => void;
};

/** GP spent on SAs during character creation (BRW gp_cost_creation column). Fallback: ⌈AP/50⌉. */
function gpCreationCostForSa(saId: string): number | null {
  const def = SA_BY_ID.get(saId);
  if (!def) return null;
  const gpc = (def as { gp_cost_creation?: unknown }).gp_cost_creation;
  if (typeof gpc === "number" && gpc > 0) return gpc;
  if (typeof def.ap_cost === "number" && def.ap_cost > 0) {
    return Math.max(1, Math.ceil(def.ap_cost / 50));
  }
  return null;
}

/**
 * Purchase SAs in order with **creation GP** (not veteran AP).
 * Mirrors {@link purchaseApSaChain}: prereqs, armor_use_i note handling.
 */
function purchaseGpSaChain(
  orderedIds: readonly string[],
  attrsFinal: CharacterSheet["attributesFinal"],
  existing: SpecialAbilityInstance[],
  gpStart: number,
  outNotes: string[],
  opts?: SaApPurchaseOpts,
): { newSas: SpecialAbilityInstance[]; gpRemaining: number } {
  const mergedIds = new Set(existing.map((s) => s.id));
  const newSas: SpecialAbilityInstance[] = [];
  let left = gpStart;
  const trace = opts?.dbg;

  for (const rawSaId of orderedIds) {
    const saId = resolveSaId(rawSaId);
    if (mergedIds.has(saId)) {
      trace?.(`[GP:SA] skip ${saId} (already owned)`);
      continue;
    }
    const def = SA_BY_ID.get(saId);
    const gpCost = gpCreationCostForSa(saId);
    if (!def || gpCost == null) {
      outNotes.push(`SA "${saId}" missing from catalog or has no GP creation cost.`);
      trace?.(`[GP:SA] abort: "${saId}" invalid or missing GP cost`);
      break;
    }
    const reqs = def.requirements ?? [];
    let abortChain = false;
    for (const raw of reqs) {
      const r = raw as {
        type?: string;
        attr?: string;
        value?: number;
        sa?: string;
      };
      if (r.type === "attr_min" && r.attr && typeof r.value === "number") {
        const ac = r.attr as AttrCode;
        const have = attrsFinal[ac] ?? 0;
        if (have < r.value) {
          outNotes.push(
            `Could not buy ${def.name ?? saId} with GP: need ${r.attr} ${r.value}+ (have ${have}).`,
          );
          trace?.(
            `[GP:SA] blocked ${def.name ?? saId}: need ${r.attr} ${r.value}+ (have ${have})`,
          );
          abortChain = true;
          break;
        }
      }
    }
    if (abortChain) break;
    for (const raw of reqs) {
      const r = raw as { type?: string; sa?: string };
      if (r.type === "sa_required" && r.sa && !mergedIds.has(resolveSaId(r.sa))) {
        outNotes.push(
          `Could not buy ${def.name ?? saId} with GP: missing prerequisite SA "${r.sa}".`,
        );
        trace?.(
          `[GP:SA] blocked ${def.name ?? saId}: missing prerequisite SA "${r.sa}"`,
        );
        abortChain = true;
        break;
      }
    }
    if (abortChain) break;
    if (left < gpCost) {
      outNotes.push(
        `Could not buy ${def.name ?? saId} with GP: needs ${gpCost} GP (${left} GP left).`,
      );
      trace?.(
        `[GP:SA] insufficient GP for ${def.name ?? saId}: needs ${gpCost}, have ${left}`,
      );
      break;
    }
    const inst: SpecialAbilityInstance = {
      id: saId,
      name: def.name,
      ...(saId === "armor_use_i" && opts?.armorUseINote ? { note: opts.armorUseINote } : {}),
    };
    newSas.push(inst);
    mergedIds.add(saId);
    left -= gpCost;
    trace?.(`[GP:SA] bought ${def.name ?? saId} (${saId}) cost=${gpCost} GP → ${left} GP left`);
  }

  return { newSas, gpRemaining: left };
}

/**
 * Purchase SAs in order with AP; stops on first unmet prereq, unmet attribute, or unaffordable cost.
 */
function purchaseApSaChain(
  orderedIds: readonly string[],
  attrsFinal: CharacterSheet["attributesFinal"],
  existing: SpecialAbilityInstance[],
  startExtraLeft: number,
  outNotes: string[],
  opts?: SaApPurchaseOpts,
): { newSas: SpecialAbilityInstance[]; extraLeft: number } {
  const mergedIds = new Set(existing.map((s) => s.id));
  const newSas: SpecialAbilityInstance[] = [];
  let left = startExtraLeft;
  const trace = opts?.dbg;

  for (const rawSaId of orderedIds) {
    const saId = resolveSaId(rawSaId);
    if (mergedIds.has(saId)) {
      trace?.(`[SA] skip ${saId} (already owned)`);
      continue;
    }
    const def = SA_BY_ID.get(saId);
    if (!def || typeof def.ap_cost !== "number") {
      outNotes.push(`SA "${saId}" missing from catalog or has no ap_cost.`);
      trace?.(`[SA] abort: "${saId}" missing from catalog or has no ap_cost`);
      break;
    }
    const reqs = def.requirements ?? [];
    let abortChain = false;
    for (const raw of reqs) {
      const r = raw as {
        type?: string;
        attr?: string;
        value?: number;
        sa?: string;
      };
      if (r.type === "attr_min" && r.attr && typeof r.value === "number") {
        const ac = r.attr as AttrCode;
        const have = attrsFinal[ac] ?? 0;
        if (have < r.value) {
          outNotes.push(
            `Could not buy ${def.name ?? saId}: need ${r.attr} ${r.value}+ (have ${have}).`,
          );
          trace?.(
            `[SA] blocked ${def.name ?? saId}: need ${r.attr} ${r.value}+ (have ${have})`,
          );
          abortChain = true;
          break;
        }
      }
    }
    if (abortChain) break;
    for (const raw of reqs) {
      const r = raw as { type?: string; sa?: string };
      if (r.type === "sa_required" && r.sa && !mergedIds.has(resolveSaId(r.sa))) {
        outNotes.push(
          `Could not buy ${def.name ?? saId}: missing prerequisite SA "${r.sa}".`,
        );
        trace?.(
          `[SA] blocked ${def.name ?? saId}: missing prerequisite SA "${r.sa}"`,
        );
        abortChain = true;
        break;
      }
    }
    if (abortChain) break;
    if (left < def.ap_cost) {
      outNotes.push(
        `Could not buy ${def.name ?? saId}: needs ${def.ap_cost} AP (${left} AP left).`,
      );
      trace?.(
        `[SA] insufficient AP for ${def.name ?? saId}: needs ${def.ap_cost}, have ${left}`,
      );
      break;
    }
    const inst: SpecialAbilityInstance = {
      id: saId,
      name: def.name,
      ...(saId === "armor_use_i" && opts?.armorUseINote
        ? { note: opts.armorUseINote }
        : {}),
    };
    newSas.push(inst);
    mergedIds.add(saId);
    left -= def.ap_cost;
    trace?.(
      `[SA] bought ${def.name ?? saId} (${saId}) cost=${def.ap_cost} AP, ${left} AP remaining`,
    );
  }

  return { newSas, extraLeft: left };
}

const STALE_INSUFFICIENT_AP_SA_NOTE =
  /^Could not buy (.+?): needs \d+ AP \(\d+ AP left\)\.$/;

/** Drop "needs N AP …" diagnostics that no longer apply because the SA was acquired later (e.g. early shield/armor pass vs veteran spending). */
function removeStaleInsufficientApSaNotes(
  ownedSas: SpecialAbilityInstance[],
  notes: string[],
): void {
  const ownedLabels = new Set<string>();
  for (const inst of ownedSas) {
    const def = SA_BY_ID.get(inst.id);
    ownedLabels.add(def?.name ?? inst.name ?? inst.id);
    ownedLabels.add(inst.id);
  }
  for (let i = notes.length - 1; i >= 0; i--) {
    const line = notes[i];
    const m = line.match(STALE_INSUFFICIENT_AP_SA_NOTE);
    if (m?.[1] != null && ownedLabels.has(m[1])) notes.splice(i, 1);
  }
}

/**
 * Ordered shield/AP chain IDs when loadout requires shield combat: off-hand (if missing),
 * Shield Fighting I / II — {@link purchaseApSaChain} skips steps already owned.
 */
function orderedGenerationShieldSaIds(
  merged: Set<string>,
  allowSaHighTiers: boolean,
  input: GenerateCharacterInput,
): string[] {
  if (!inputIncludesShieldFromInput(input)) return [];
  const hasShieldLine =
    merged.has("shield_fighting_i") || merged.has("shield_fighting_ii");
  const ids: string[] = [];
  if (!hasShieldLine) {
    ids.push("off_hand_fighting");
  }
  if (!merged.has("shield_fighting_i")) {
    ids.push("shield_fighting_i");
  }
  if (allowSaHighTiers && !merged.has("shield_fighting_ii")) {
    ids.push("shield_fighting_ii");
  }
  return ids;
}

/** Armor Use chain IDs when the player opted into Armor Use — purchaser skips tiers already owned. */
function orderedGenerationArmorSaIds(allowSaHighTiers: boolean): string[] {
  const ids: string[] = [];
  ids.push("armor_use_i");
  if (allowSaHighTiers) {
    ids.push("armor_use_ii", "armor_use_iii");
  }
  return ids;
}

/**
 * Ordered parrying weapon SA chain IDs when loadout includes a parrying weapon and the player
 * opted in: off_hand_fighting (if missing) → parrying_weapons_i → parrying_weapons_ii.
 * Skips steps already owned.
 */
function orderedGenerationParryingWeaponSaIds(
  merged: Set<string>,
  allowSaHighTiers: boolean,
  input: GenerateCharacterInput,
): string[] {
  if (!inputIncludesParryingWeapon(input)) return [];
  if (!input.buyParryingWeaponSa) return [];
  const ids: string[] = [];
  if (!merged.has("off_hand_fighting")) {
    ids.push("off_hand_fighting");
  }
  if (!merged.has("parrying_weapons_i")) {
    ids.push("parrying_weapons_i");
  }
  if (allowSaHighTiers && !merged.has("parrying_weapons_ii")) {
    ids.push("parrying_weapons_ii");
  }
  return ids;
}

/**
 * True for continuation SAs (at least one satisfied `sa_required`). Root SAs are only bought
 * via {@link orderedGenerationShieldSaIds} / {@link orderedGenerationArmorSaIds} when the
 * wizard/loadout requires them.
 */
function isChainUpgradeSa(
  def: (typeof specialAbilitiesData.special_abilities)[number],
  ownedIds: Set<string>,
): boolean {
  const reqs = def.requirements ?? [];
  let hasSaPrereq = false;
  for (const raw of reqs) {
    const r = raw as { type?: string; sa?: string };
    if (r.type === "sa_required" && r.sa) {
      hasSaPrereq = true;
      if (!ownedIds.has(resolveSaId(r.sa))) return false;
    }
  }
  return hasSaPrereq;
}

type PostCreationApCosts = {
  post_creation_ap?: {
    vitality_point_ap?: number | null;
    astral_point_ap?: number | null;
  };
};

/** Spend residual veteran AP on VP / ASP when costs are present in advancement JSON. */
function trySpendResidualVpAsp(
  extraApBudget: number,
  extraLeft: number,
  fullMagic: boolean,
  outNotes: string[],
  dbg?: (line: string) => void,
): {
  extraLeft: number;
  vpDelta: number;
  aspDelta: number;
} {
  if (extraApBudget < 2000) {
    return { extraLeft, vpDelta: 0, aspDelta: 0 };
  }
  const post = (advancementCosts as PostCreationApCosts).post_creation_ap;
  if (!post) return { extraLeft, vpDelta: 0, aspDelta: 0 };

  let left = extraLeft;
  let vpDelta = 0;
  let aspDelta = 0;
  const vpCost = post.vitality_point_ap;
  if (typeof vpCost === "number" && vpCost > 0) {
    let n = 0;
    while (n < 5 && left >= vpCost) {
      left -= vpCost;
      vpDelta += 1;
      n++;
      dbg?.(
        `[ResidualAP] +1 VP (-${vpCost} AP), ${left} AP remaining (VP total +${vpDelta})`,
      );
    }
    if (n > 0) {
      outNotes.push(`Veteran AP residual: +${n} VP (${vpCost} AP each).`);
    }
  }
  const aspCost = post.astral_point_ap;
  if (
    fullMagic &&
    typeof aspCost === "number" &&
    aspCost > 0
  ) {
    let n = 0;
    while (n < 10 && left >= aspCost) {
      left -= aspCost;
      aspDelta += 1;
      n++;
      dbg?.(
        `[ResidualAP] +1 ASP (-${aspCost} AP), ${left} AP remaining (ASP total +${aspDelta})`,
      );
    }
    if (n > 0) {
      outNotes.push(`Veteran AP residual: +${n} ASP (${aspCost} AP each).`);
    }
  }
  return { extraLeft: left, vpDelta, aspDelta };
}

const MAX_PURCHASED_ATTR_FOR_VETERAN = 29;

function computeDerivedForSheet(
  attrsFinal: CharacterSheet["attributesFinal"],
  race: (typeof racesData.races)[number],
  culture: (typeof culturesData.cultures)[number],
  profession: (typeof professionsData.professions)[number],
  fullMagic: boolean,
): CharacterSheet["derived"] {
  const CL = attrsFinal.CL;
  const IN = attrsFinal.IN;
  const CO = attrsFinal.CO;
  const CN = attrsFinal.CN;
  const ST = attrsFinal.ST;
  const AG = attrsFinal.AG;
  const CH = attrsFinal.CH;
  const DE = attrsFinal.DE;

  const VP =
    Math.ceil((CN + CN + ST) / 2) +
    (race.derived_modifiers?.VP ?? 0) +
    (culture.derived_modifiers?.VP ?? 0) +
    (profession.derived_modifiers?.VP ?? 0);

  const EP =
    Math.ceil((CO + CN + AG) / 2) +
    (race.derived_modifiers?.EP ?? 0) +
    (culture.derived_modifiers?.EP ?? 0) +
    (profession.derived_modifiers?.EP ?? 0);

  const WT = Math.ceil(CN / 2);
  const baseAT = Math.round((CO + AG + ST) / 5);
  const basePA = Math.round((IN + AG + ST) / 5);
  const baseBRV = Math.round((IN + DE + ST) / 5);
  const baseINI =
    Math.round((CO + CO + IN + AG) / 5) +
    (race.derived_modifiers &&
    "INI" in race.derived_modifiers &&
    typeof (race.derived_modifiers as { INI?: number }).INI === "number"
      ? (race.derived_modifiers as { INI: number }).INI
      : 0);

  const cultRm = (culture.derived_modifiers as { RM?: number } | undefined)?.RM ?? 0;
  const profRm =
    (profession.derived_modifiers as { RM?: number } | undefined)?.RM ?? 0;
  const RM =
    Math.round((CO + CL + CN) / 5) +
    (race.derived_modifiers?.RM ?? 0) +
    cultRm +
    profRm;

  const cultAsp =
    (culture.derived_modifiers as { ASP?: number } | undefined)?.ASP ?? 0;
  const profAsp =
    (profession.derived_modifiers as { ASP?: number } | undefined)?.ASP ?? 0;
  const ASP = fullMagic
    ? Math.ceil((CO + IN + CH) / 2) +
      (race.derived_modifiers?.ASP ?? 0) +
      cultAsp +
      profAsp
    : 0;

  const GS = 8;

  return {
    VP,
    EP,
    WT,
    baseAT,
    basePA,
    baseBRV,
    baseINI,
    RM,
    ASP,
    GS,
  };
}

/** AP cost column H SKT raise for purchased base attribute `v`→`v+1`. */
function computePurchasedAttrStepCostPurchased(fromVal: number): number | null {
  const h = advancementCosts.talent_columns.columns.H?.costs_by_value;
  if (!h || typeof fromVal !== "number" || fromVal >= MAX_PURCHASED_ATTR_FOR_VETERAN)
    return null;
  const key = `${fromVal}_to_${fromVal + 1}`;
  const c = (h as Record<string, number>)[key];
  return typeof c === "number" ? c : null;
}

type VeteranSpendMode = "mixed" | "talents_only" | "spells_only";

export type WizardSpellMode = "lead_spells" | "extra_activations";

export type WizardSpellOptions = {
  mode: WizardSpellMode;
  leadCount: number;
  packageSpells: { id: string; name: string; sp: number; isHouse: boolean }[];
  spells: { id: string; name: string; description: string; traditions: string[] }[];
};

export function needsSpellSelectionStep(
  raceId: string,
  professionId: string,
  halfElfFullCaster: boolean
): boolean {
  return isFullCaster(raceId, professionId, halfElfFullCaster);
}

/** Lite spell rows for the creation wizard (client avoids loading full spells.json). */
export function listSpellsForWizard(
  raceId: string,
  professionId: string,
  halfElfFullCaster: boolean,
  cultureId?: string,
): WizardSpellOptions {
  const empty: WizardSpellOptions = {
    mode: "extra_activations",
    leadCount: 0,
    packageSpells: [],
    spells: [],
  };
  if (!isFullCaster(raceId, professionId, halfElfFullCaster)) return empty;

  const culture = cultureId ? lookupCulture(cultureId) : undefined;
  const profession = lookupProfession(professionId);
  const role = resolveSpellCasterRole({
    raceId,
    professionId,
    halfElfFullCaster,
    profession,
    culture,
  });
  const packageSpells = collectPackageSpells(culture, profession);
  const packageIds = new Set(packageSpells.map((p) => p.id));
  const leadCount = cultureLeadSpellCount(culture);
  const elvish = cultureHasElvishWorldView(culture);
  const mode: WizardSpellMode =
    elvish && leadCount > 0 ? "lead_spells" : "extra_activations";

  const extraSpells = spellsData.spells
    .filter((s) => spellApplicable(s, role) && !packageIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      traditions: s.traditions ?? [],
    }));

  return {
    mode,
    leadCount,
    packageSpells: packageSpells.map((p) => ({
      id: p.id,
      name: getSpellDef(p.id)?.name ?? p.id,
      sp: p.sp,
      isHouse: p.isHouse,
    })),
    spells: extraSpells,
  };
}

export function generateCharacter(
  input: GenerateCharacterInput,
  seed?: number
): CharacterSheet {
  const rng = mulberry32(seed ?? Date.now() % 2147483647);
  const notes: string[] = [];
  const debugLog: string[] = [];
  const dbg = input.debugMode
    ? (line: string) => {
        debugLog.push(line);
      }
    : (_line: string) => {};
  const extraApBudget = Math.max(0, Math.floor(input.extraAp ?? 0));
  dbg(
    `[Start] seed=${seed !== undefined ? String(seed) : "auto"} extraAp=${extraApBudget} apProfile=${input.apProfileId ?? "default"} buyArmorUse=${Boolean(input.buyArmorUseSa)}`,
  );

  let race =
    input.raceId === "random"
      ? pick(rng, racesData.races)
      : racesData.races.find((r) => r.id === input.raceId)!;
  if (!race) throw new Error("Invalid race");

  const culturesFiltered = culturesData.cultures.filter(
    (c) => raceAllowsCulture(race, c.id) && cultureAllowsRace(c, race.id)
  );
  if (!culturesFiltered.length) {
    throw new Error(
      `No playable culture intersects race "${race.id}" — check races.json allowed_cultures and cultures.json allowed_races.`,
    );
  }
  let culture =
    input.cultureId === "random"
      ? pick(rng, culturesFiltered)
      : culturesData.cultures.find((c) => c.id === input.cultureId)!;
  if (
    !culture ||
    !raceAllowsCulture(race, culture.id) ||
    !cultureAllowsRace(culture, race.id)
  ) {
    culture = pick(rng, culturesFiltered);
    notes.push("Culture invalid for race; picked compatible culture.");
  }

  const profs = professionsData.professions.filter((p) => {
    if (!isProfessionSelectable(p)) return false;
    if (!cultureAllowsProfession(culture, p.id)) return false;
    const raceReq = p.requirements.find(
      (r): r is { type: "race"; race: string } => r.type === "race"
    );
    if (raceReq && !satisfiesProfessionRaceRequirement(raceReq.race, race.id))
      return false;
    return true;
  });
  let profession =
    input.professionId === "random"
      ? pick(rng, profs.length ? profs : professionsData.professions.filter(isProfessionSelectable))
      : professionsData.professions.find((p) => p.id === input.professionId)!;
  if (
    !profession ||
    !isProfessionSelectable(profession) ||
    !cultureAllowsProfession(culture, profession.id)
  ) {
    profession = pick(rng, profs.length ? profs : professionsData.professions.filter(isProfessionSelectable));
    notes.push("Profession invalid for culture; picked compatible profession.");
  }

  // Generation weights now live on the profession (formerly concepts).
  type ProfWeights = {
    talent_group_weights?: Record<string, number>;
    talent_bias?: Record<string, number>;
    talent_avoid_bias?: Record<string, number>;
    attribute_bias?: Partial<Record<AttrCode, number>>;
    advantage_pick_bias?: Record<string, number>;
    disadvantage_pick_bias?: Record<string, number>;
    at_pa_bias?: string;
    spell_group_weight?: number;
    category?: string;
  };
  const weights = profession as typeof profession & ProfWeights;
  const wSpellGwRaw = weights.spell_group_weight;
  const spellGroupWeightForVeteran =
    typeof wSpellGwRaw === "number" &&
    Number.isFinite(wSpellGwRaw) &&
    wSpellGwRaw > 0
      ? wSpellGwRaw
      : 0;
  /** SGP: use profession weight when >0, else 1 so priorities still skew SP spend among spells. */
  const spellGroupWeightForSgp =
    typeof wSpellGwRaw === "number" &&
    Number.isFinite(wSpellGwRaw) &&
    wSpellGwRaw > 0
      ? wSpellGwRaw
      : 1;
  const advantagePickBias = normalizeTraitPickBias(weights.advantage_pick_bias);
  const disadvantagePickBias = normalizeTraitPickBias(
    weights.disadvantage_pick_bias
  );

  dbg(
    `[Identity] race=${race.id} culture=${culture.id} profession=${profession.id}`,
  );

  function resolveAutomaticTraitList(
    rows: CharacterSheet["automaticAdvantages"],
    kind: "advantage" | "disadvantage",
  ): CharacterSheet["automaticAdvantages"] {
    const out: CharacterSheet["automaticAdvantages"] = [];
    const seen = new Set<string>();
    for (const raw of rows) {
      const enriched = enrichTraitInstance(raw, kind);
      if (enriched.pick_one_disadvantages?.length) {
        const alt = pick(rng, enriched.pick_one_disadvantages);
        const chosen = enrichTraitInstance(
          { id: alt.id, rating: alt.rating, note: alt.note },
          kind,
        );
        if (seen.has(chosen.id)) continue;
        seen.add(chosen.id);
        out.push(chosen);
        continue;
      }
      if (seen.has(enriched.id)) continue;
      seen.add(enriched.id);
      out.push(enriched);
    }
    return out;
  }

  const automaticAdvantages = resolveAutomaticTraitList(
    [
      ...((race.automatic_advantages ?? []) as CharacterSheet["automaticAdvantages"]),
      ...((profession.automatic_advantages ?? []) as CharacterSheet["automaticAdvantages"]),
    ],
    "advantage",
  );
  const automaticDisadvantages = resolveAutomaticTraitList(
    [
      ...((race.automatic_disadvantages ?? []) as CharacterSheet["automaticDisadvantages"]),
      ...((culture.automatic_disadvantages ?? []) as CharacterSheet["automaticDisadvantages"]),
      ...((profession.automatic_disadvantages ?? []) as CharacterSheet["automaticDisadvantages"]),
    ],
    "disadvantage",
  );
  const ownedAutomaticTraitIds = new Set([
    ...automaticAdvantages.map((t) => t.id),
    ...automaticDisadvantages.map((t) => t.id),
  ]);
  const unsuitable = collectUnsuitableTraitKeys(race, culture, profession);

  const halfElfFullCaster = Boolean(input.halfElfFullCaster);
  let raceGp = race.gp_cost ?? 0;
  if (race.id === "half_elf" && halfElfFullCaster) raceGp += 8;

  const cultureGp = culture.gp_cost ?? 0;
  const professionGp = profession.gp_cost ?? 0;

  const soRange = professionSoRange(profession);
  const hasWarriorAcademicTraining = (profession.automatic_advantages ?? []).some(
    (t) =>
      t.id === "academic_training" &&
      (profession.id === "warrior" ||
        /warrior/i.test((t as { note?: string }).note ?? "")),
  );
  const soMinEffective = Math.max(1, soRange.min - (hasWarriorAcademicTraining ? 1 : 0));
  const gender = resolveGenerationGender(input, race.id, profession, rng);
  const so = generateSo(rng, { min: soMinEffective, max: soRange.max });
  const soExtraGp = Math.max(0, so - soMinEffective);

  const minsAfterMods: Partial<Record<AttrCode, number>> = {};
  const rawMins = professionAttrMins(profession);
  const raceMod = (race.attribute_modifiers ?? {}) as Record<string, number>;
  const cultMod = (culture.attribute_modifiers ?? {}) as Record<string, number>;
  for (const a of ATTR_CODES) {
    const req = rawMins[a];
    if (req === undefined) continue;
    const rm = raceMod[a] ?? 0;
    const cm = cultMod[a] ?? 0;
    minsAfterMods[a] = Math.max(8, Math.min(14, req - rm - cm));
  }
  if (gender === "female" && DWARF_STATURE_RACE_IDS.has(race.id)) {
    minsAfterMods.CO = Math.max(minsAfterMods.CO ?? 8, 12);
  }

  const effectiveAttrBias: Partial<Record<AttrCode, number>> = {
    ...((weights.attribute_bias ?? {}) as Partial<Record<AttrCode, number>>),
  };
  if (extraApBudget >= 1000) {
    effectiveAttrBias.CO = (effectiveAttrBias.CO ?? 0) + 1;
    effectiveAttrBias.AG = (effectiveAttrBias.AG ?? 0) + 1;
    effectiveAttrBias.ST = (effectiveAttrBias.ST ?? 0) + 1;
    effectiveAttrBias.DE = (effectiveAttrBias.DE ?? 0) + 0.5;
  }
  if (extraApBudget >= 2000) {
    effectiveAttrBias.ST = (effectiveAttrBias.ST ?? 0) + 1;
    effectiveAttrBias.IN = (effectiveAttrBias.IN ?? 0) + 0.5;
  }

  let purchased = solveAttributes(
    rng,
    minsAfterMods,
    effectiveAttrBias
  );
  let attrSum = ATTR_CODES.reduce((s, a) => s + purchased[a], 0);

  dbg(
    `[Attributes] mins: ${ATTR_CODES.map((a) => `${a}=${purchased[a]}`).join(", ")} sum=${attrSum}`,
  );

  let gp =
    GP_START -
    raceGp -
    cultureGp -
    professionGp -
    attrSum -
    soExtraGp;

  dbg(
    `[GP] before traits: GP_START=${GP_START} − raceGp=${raceGp} − cultureGp=${cultureGp} − professionGp=${professionGp} − attrSum=${attrSum} − soExtraGp=${soExtraGp} ⇒ gp=${gp}`,
  );

  const chosenAdvantages: CharacterSheet["chosenAdvantages"] = [];
  const chosenDisadvantages: CharacterSheet["chosenDisadvantages"] = [];

  const disPool = disadvantagesData.disadvantages.filter(
    (d) =>
      !d.auto_only &&
      typeof d.gp_refund === "number" &&
      !d.is_leveled &&
      !d.is_magical &&
      !unsuitable.ids.has(d.id) &&
      !unsuitable.names.has(traitNameKey(d.name)) &&
      !ownedAutomaticTraitIds.has(d.id) &&
      !(d.incompatible_with ?? []).some((id) => ownedAutomaticTraitIds.has(id)),
  );

  let disGpTotal = 0;
  let badTraitGp = 0;
  const tryDis = () => {
    const candidates = disPool.filter((d) => {
      const g = disadvantageRefundGP(d);
      if (disGpTotal + g > 50) return false;
      if (d.is_bad_trait && badTraitGp + g > 30) return false;
      return true;
    });
    if (!candidates.length) return false;
    const d = pickWeightedByIdBias(rng, candidates, disadvantagePickBias);
    const g = disadvantageRefundGP(d);
    chosenDisadvantages.push({ id: d.id, name: d.name });
    disGpTotal += g;
    if (d.is_bad_trait) badTraitGp += g;
    gp += g;
    dbg(`[GP] disadvantage "${d.name}" (+${g} GP refund) → gp=${gp}`);
    return true;
  };

  const advPool = advantagesData.advantages.filter(
    (a): a is typeof a & { gp_cost: number } =>
      !a.auto_only &&
      typeof a.gp_cost === "number" &&
      a.gp_cost > 0 &&
      a.gp_cost <= 12 &&
      !unsuitable.ids.has(a.id) &&
      !unsuitable.names.has(traitNameKey(a.name)) &&
      !ownedAutomaticTraitIds.has(a.id) &&
      !(a.incompatible_with ?? []).some((id) => ownedAutomaticTraitIds.has(id)),
  );

  while (gp < 0) {
    if (!tryDis()) {
      notes.push("Could not balance GP deficit with disadvantages; clamping.");
      gp = 0;
      break;
    }
  }

  {
    const raised = raiseAttributesWithRemainingGp(
      rng,
      purchased,
      gp,
      effectiveAttrBias,
    );
    purchased = raised.purchased;
    gp = raised.gp;
    attrSum = raised.attrSum;
    dbg(
      `[Attributes] after leftover GP: ${ATTR_CODES.map((a) => `${a}=${purchased[a]}`).join(", ")} sum=${attrSum} gp=${gp}`,
    );
  }

  /** Attributes stable for SA prereqs (race/culture only; advantages do not change attrs here). */
  const attrsForCreationSaPurchases = {
    ...applyAttrMods(purchased, race, culture),
    SO: so,
  } as CharacterSheet["attributesFinal"];

  const creationAutomaticSa = dedupeSpecialAbilitiesById([
    ...((race.automatic_SAs ?? []) as CharacterSheet["specialAbilities"]),
    ...((culture.automatic_SAs ?? []) as CharacterSheet["specialAbilities"]),
    ...((profession.automatic_SAs ?? []) as CharacterSheet["specialAbilities"]),
  ]);
  let gpCombatLoadoutPurchased: CharacterSheet["specialAbilities"] = [];
  /** Creation GP buys loadout-required combat SAs before random advantages consume GP (veteran AP still tops up afterward). */
  {
    let workingSasForGp = [...creationAutomaticSa];
    const includeHighTierSasForGp = true;

    const runGpCombatLoadout = (ids: readonly string[], armorUseINote?: string | null) => {
      if (ids.length === 0) return;
      const res = purchaseGpSaChain(
        ids,
        attrsForCreationSaPurchases,
        workingSasForGp,
        gp,
        notes,
        {
          dbg,
          ...(armorUseINote ? { armorUseINote } : {}),
        },
      );
      gpCombatLoadoutPurchased.push(...res.newSas);
      workingSasForGp.push(...res.newSas);
      gp = res.gpRemaining;
    };

    runGpCombatLoadout(
      orderedGenerationShieldSaIds(
        new Set(workingSasForGp.map((s) => s.id)),
        includeHighTierSasForGp,
        input,
      ),
    );

    if (input.buyArmorUseSa) {
      const armorGpNote = pickArmorUseOneNoteForInput(input);
      if (armorGpNote) {
        runGpCombatLoadout(
          orderedGenerationArmorSaIds(includeHighTierSasForGp),
          armorGpNote,
        );
      }
    }

    if (input.buyParryingWeaponSa && inputIncludesParryingWeapon(input)) {
      runGpCombatLoadout(
        orderedGenerationParryingWeaponSaIds(
          new Set(workingSasForGp.map((s) => s.id)),
          includeHighTierSasForGp,
          input,
        ),
      );
    }
  }

  while (gp > 0 && advPool.length) {
    const affordable = advPool.filter((a) => a.gp_cost <= gp);
    if (!affordable.length) break;
    const a = pickWeightedByIdBias(rng, affordable, advantagePickBias);
    chosenAdvantages.push({ id: a.id, name: a.name });
    gp -= a.gp_cost;
    dbg(`[GP] advantage "${a.name}" (-${a.gp_cost} GP) → gp=${gp}`);
  }
  while (gp < 0) {
    if (!tryDis()) {
      notes.push("Could not finish GP balance after advantages.");
      gp = 0;
      break;
    }
  }
  if (gp > 0)
    notes.push(
      `GP not fully spent (${gp} left); leftover GP is legal after packages, attributes, and advantages.`,
    );

  dbg(
    `[GP] after spend/balance: gp=${gp} advantages=${chosenAdvantages.length} disadvantages=${chosenDisadvantages.length} (GP formula: ${GP_START} − race − culture − profession − attrSum ${attrSum} − soExtra ${soExtraGp})`,
  );

  const advantageIdsForTalentCap = new Set([
    ...chosenAdvantages.map((a) => a.id),
    ...automaticAdvantages.map((a) => a.id),
  ]);

  const attrsFinalRecordInitial = applyAttrMods(purchased, race, culture);
  let attrsFinal = {
    ...attrsFinalRecordInitial,
    SO: so,
  } as CharacterSheet["attributesFinal"];

  const fullMagic = isFullCaster(race.id, profession.id, halfElfFullCaster);

  let derived = computeDerivedForSheet(
    attrsFinal,
    race,
    culture,
    profession,
    fullMagic,
  );

  function refreshAttrsFromPurchased(): void {
    const rec = applyAttrMods(purchased, race, culture);
    for (const a of ATTR_CODES)
      attrsFinal[a] = rec[a]!;
    Object.assign(
      derived,
      computeDerivedForSheet(attrsFinal, race, culture, profession, fullMagic),
    );
  }

  const CL = attrsFinal.CL;
  const IN = attrsFinal.IN;

  const educatedRating = [...automaticAdvantages, ...chosenAdvantages]
    .filter((t) => t.id === "educated")
    .reduce((s, t) => s + Math.max(1, t.rating ?? 1), 0);
  const educatedAp = educatedRating * 40;
  const tgpTotal = (CL + IN) * 20 + educatedAp;
  const sgpTotal = Math.round(((CL + IN) * 20) / 2) + Math.round(educatedAp / 2);
  let tgpLeft = tgpTotal;
  let sgpLeft = sgpTotal;
  dbg(
    `[Creation] AP pool: 20×(CL+IN)=${(CL + IN) * 20}` +
      (educatedAp ? ` + Educated ${educatedRating}×40=${educatedAp}` : "") +
      ` = ${tgpTotal}; magic cap=${sgpTotal}`,
  );

  const weaponBiasRows = collectWeaponBiasRows(input);
  const weaponLinkedCombatIds = collectWeaponLinkedCombatTalentIds(input);
  const mergedTalents = mergeTalentModifiersNormalized(
    rng,
    race,
    culture,
    profession,
    weaponLinkedCombatIds,
  );
  const talentRows: CharacterSheet["talents"] = [];
  const talentTp = new Map<string, number>();
  for (const [id, mod] of Object.entries(mergedTalents)) {
    talentTp.set(id, mod);
  }
  applyCultureLanguages(culture, talentTp, CL);
  clampTalentTpMapToCreationMax(talentTp, attrsFinal, advantageIdsForTalentCap);
  const cols = advancementCosts.talent_columns.columns;
  const groupWeights = weights.talent_group_weights as
    | Record<string, number>
    | undefined;
  const talentBias: Record<string, number> = {
    ...normalizeTalentBias(weights.talent_bias),
  };
  const WEAPON_TALENT_BIAS_ADD = 2.25;
  const WEAPON_TALENT_BIAS_FLOOR = 3.75;
  for (const tid of weaponLinkedCombatIds) {
    const def = TALENT_INDEX.get(tid);
    if (!def || def.group !== "combat_talents") continue;
    talentBias[tid] = Math.max(
      (talentBias[tid] ?? 1) + WEAPON_TALENT_BIAS_ADD,
      WEAPON_TALENT_BIAS_FLOOR
    );
  }
  const weaponFocus = weaponTalentFocusFromLinked(weaponLinkedCombatIds);

  const talentAvoid = normalizeTalentAvoidBias(weights.talent_avoid_bias);

  /** BRW p. 46: at most 5 new specialized-talent activations during creation. */
  let activationsRemaining = 5;
  const creationTalentBudget = { tgpLeft, activationsRemaining };
  ensureWeaponCombatTalentsForLoadout(
    weaponLinkedCombatIds,
    talentTp,
    cols,
    attrsFinal,
    advantageIdsForTalentCap,
    creationTalentBudget,
  );
  tgpLeft = creationTalentBudget.tgpLeft;
  activationsRemaining = creationTalentBudget.activationsRemaining;

  const spendPool = buildTalentSpendPool(Object.keys(mergedTalents));
  spendPool.sort(() => rng() - 0.5);

  const spells: CharacterSheet["spells"] = [];
  const houseSpellIds = new Set<string>();
  const leadSpellIds = new Set<string>();
  const elvishWorldView = cultureHasElvishWorldView(culture);
  const spellRole: SpellCasterRole = resolveSpellCasterRole({
    raceId: race.id,
    professionId: profession.id,
    halfElfFullCaster,
    profession,
    culture,
  });

  function trySpendCreationMagic(cost: number): boolean {
    if (cost <= 0) return true;
    if (cost > tgpLeft || cost > sgpLeft) return false;
    tgpLeft -= cost;
    sgpLeft -= cost;
    return true;
  }

  function canSpendCreationMagic(cost: number): boolean {
    if (cost <= 0) return true;
    return cost <= tgpLeft && cost <= sgpLeft;
  }

  if (fullMagic) {
    const talentCols = advancementCosts.talent_columns.columns;
    const packageSpells = collectPackageSpells(culture, profession);
    const packageIds = new Set(packageSpells.map((p) => p.id));
    for (const p of packageSpells) {
      if (p.isHouse) houseSpellIds.add(p.id);
    }

    type Activated = {
      s: (typeof spellsData.spells)[number];
      col: string;
      maxSp: number;
      sp: number;
    };
    const activated: Activated[] = [];

    for (const p of packageSpells) {
      const s = getSpellDef(p.id);
      if (!s) {
        notes.push(`Package spell "${p.id}" is not in the spell catalog; skipped.`);
        continue;
      }
      if (elvishWorldView) leadSpellIds.add(s.id);
      const col = spellColumnFor(s, spellRole, houseSpellIds, leadSpellIds, elvishWorldView);
      activated.push({
        s,
        col,
        maxSp: calculateSpellMaxSp(s, attrsFinal, spellRole, "creation"),
        sp: p.sp,
      });
    }

    const extraPool = spellsData.spells.filter(
      (s) => spellApplicable(s, spellRole) && !packageIds.has(s.id),
    );
    const leadCount = cultureLeadSpellCount(culture);
    const requestedLeads = (input.leadSpellPicks ?? [])
      .map((id) => resolveSpellCatalogId(id) ?? id)
      .filter((id) => extraPool.some((s) => s.id === id));
    let leadPicks: string[] = [];
    if (elvishWorldView && leadCount > 0) {
      if (requestedLeads.length === leadCount) {
        leadPicks = requestedLeads;
      } else {
        const shuffled = [...extraPool].sort(() => rng() - 0.5);
        const high = shuffled.filter((s) => spellPriorityBase(input.spellPriorities?.[s.id]) > 0);
        const rest = shuffled.filter((s) => spellPriorityBase(input.spellPriorities?.[s.id]) === 0);
        leadPicks = [...high, ...rest].slice(0, leadCount).map((s) => s.id);
      }
      for (const id of leadPicks) leadSpellIds.add(id);
    }

    const maxActs = advancementCosts.spell_columns.max_activations_at_creation;
    let acts = 0;
    const extraRanked = extraPool
      .map((s) => ({
        s,
        base: leadSpellIds.has(s.id) ? 4 : spellPriorityBase(input.spellPriorities?.[s.id]),
        w: (leadSpellIds.has(s.id) ? 4 : spellPriorityBase(input.spellPriorities?.[s.id])) + rng() * 0.01,
      }))
      .sort((a, b) => b.w - a.w);

    let extraList = extraRanked.filter((x) => x.base > 0);
    if (extraList.length === 0 && extraRanked.length > 0 && leadPicks.length === 0) {
      notes.push(
        "No extra spells were prioritized; used the remaining list with equal weight for leftover activations.",
      );
      extraList = extraRanked.map((x) => ({ ...x, base: 1, w: 1 + rng() * 0.01 }));
      extraList.sort((a, b) => b.w - a.w);
    }

    const activationQueue = [
      ...extraList.filter((x) => leadSpellIds.has(x.s.id)),
      ...extraList.filter((x) => !leadSpellIds.has(x.s.id)),
    ];

    for (const { s } of activationQueue) {
      if (acts >= maxActs) break;
      if (activated.some((a) => a.s.id === s.id)) continue;
      const col = spellColumnFor(s, spellRole, houseSpellIds, leadSpellIds, elvishWorldView);
      const act = spellActivationCost(talentCols, col);
      const isLeadPick = leadSpellIds.has(s.id);
      if (!isLeadPick && !trySpendCreationMagic(act)) continue;
      if (isLeadPick && !trySpendCreationMagic(act)) {
        notes.push(`Could not pay activation for lead spell "${s.name}"; added at SP 0 anyway.`);
      }
      acts++;
      activated.push({
        s,
        col,
        maxSp: calculateSpellMaxSp(s, attrsFinal, spellRole, "creation"),
        sp: 0,
      });
    }

    dbg(
      `[Spells:Creation] package=${packageSpells.length} extra_activations=${acts}/${maxActs} leads=${leadPicks.length} AP=${tgpLeft} magic=${sgpLeft}`,
    );

    let spellZfwRaiseSteps = 0;
    let sgpSpellGuards = 0;
    while (sgpSpellGuards++ < 80_000) {
      type Cand = { ent: Activated; cost: number; w: number };
      const cand: Cand[] = [];
      for (const ent of activated) {
        if (ent.sp >= ent.maxSp) continue;
        const step = spellAdvancementStepCost(talentCols, ent.col, ent.sp, ent.sp + 1);
        if (!canSpendCreationMagic(step)) continue;
        const w = spellStepPickWeight(
          input.spellPriorities?.[ent.s.id],
          spellGroupWeightForSgp,
          rng,
        );
        cand.push({ ent, cost: step, w });
      }
      if (cand.length === 0) break;
      const wTotal = cand.reduce((a, c) => a + c.w, 0);
      let r = rng() * wTotal;
      let pickEnt = cand[cand.length - 1]!;
      for (let i = 0; i < cand.length; i++) {
        r -= cand[i]!.w;
        if (r <= 0) {
          pickEnt = cand[i]!;
          break;
        }
      }
      if (!trySpendCreationMagic(pickEnt.cost)) break;
      pickEnt.ent.sp++;
      spellZfwRaiseSteps++;
    }

    dbg(
      `[Spells:Creation] SP_raise_steps=${spellZfwRaiseSteps} AP_left=${tgpLeft} magic_left=${sgpLeft}`,
    );

    for (const ent of activated) {
      spells.push({
        id: ent.s.id,
        name: ent.s.name,
        sp: ent.sp,
        tradition: (ent.s.traditions ?? []).join(","),
        advancementColumn: ent.col,
        ...(houseSpellIds.has(ent.s.id) ? { isHouseSpell: true } : {}),
        ...(leadSpellIds.has(ent.s.id) ? { isLeadSpell: true } : {}),
      });
    }
  } else {
    dbg(`[Spells:Creation] skipped (not full caster for this hero)`);
  }

  let tgpGuards = 0;
  let creationTalentSteps = 0;
  while (tgpLeft > 0 && tgpGuards++ < 150_000) {
    const candidates = spendPool.filter((id) => {
      const spend = computeTalentSpend(
        id,
        talentTp,
        cols,
        attrsFinal,
        activationsRemaining,
        tgpLeft,
        advantageIdsForTalentCap,
      );
      return spend !== null;
    });
    if (candidates.length === 0) break;
    const id = pickWeightedTalentForStep(
      rng,
      candidates,
      groupWeights,
      talentBias,
      talentAvoid,
      weaponFocus,
    );
    const spend = computeTalentSpend(
      id,
      talentTp,
      cols,
      attrsFinal,
      activationsRemaining,
      tgpLeft,
      advantageIdsForTalentCap,
    )!;
    tgpLeft -= spend.cost;
    if (spend.usesNewActivation) activationsRemaining--;
    talentTp.set(id, spend.nextTp);
    creationTalentSteps++;
    dbg(
      `[Creation:AP] ${id} spend=${spend.cost} AP → ${tgpLeft} AP left, nextTp=${spend.nextTp}${spend.usesNewActivation ? " (new activation)" : ""}`,
    );
  }

  dbg(
    `[Creation:AP] talents done: ${creationTalentSteps} step(s), ${tgpLeft} AP unspent (of ${tgpTotal})`,
  );

  const tgpSpent = tgpTotal - tgpLeft;
  const sgpSpent = sgpTotal - sgpLeft;

  dbg(
    `[Creation] totals: apSpent=${tgpSpent} magicSpent=${sgpSpent} (cap ${sgpTotal}) spells=${spells.length}`,
  );

  const creationStartFinal = { ...attrsFinal };
  activationsRemaining = 99;

  let extraLeft = extraApBudget;
  dbg(`[VeteranAP] pool start extraApBudget=${extraApBudget} (extraLeft=${extraLeft})`);

  let specialAbilitiesOut = dedupeSpecialAbilitiesById([
    ...creationAutomaticSa,
    ...gpCombatLoadoutPurchased,
  ]);
  const allowSaHighTiers = extraApBudget >= 1000;
  /** Shield/armor SA AP buys: before talents if enough veteran AP, else after (residual). */
  const SA_AP_PURCHASE_FIRST_THRESHOLD = 2000;
  const saPurchaseFirst = extraApBudget >= SA_AP_PURCHASE_FIRST_THRESHOLD;

  function applyShieldAndArmorSaAp(): void {
    const merged = new Set(specialAbilitiesOut.map((s) => s.id));

    const shieldIds = orderedGenerationShieldSaIds(merged, allowSaHighTiers, input);
    if (shieldIds.length > 0) {
      const shieldBuy = purchaseApSaChain(
        shieldIds,
        attrsFinal,
        specialAbilitiesOut,
        extraLeft,
        notes,
        { dbg },
      );
      specialAbilitiesOut.push(...shieldBuy.newSas);
      extraLeft = shieldBuy.extraLeft;
    }

    if (input.buyArmorUseSa) {
      const armorNote = pickArmorUseOneNoteForInput(input);
      if (armorNote) {
        const armorIds = orderedGenerationArmorSaIds(allowSaHighTiers);
        const armorBuy = purchaseApSaChain(
          armorIds,
          attrsFinal,
          specialAbilitiesOut,
          extraLeft,
          notes,
          { armorUseINote: armorNote, dbg },
        );
        specialAbilitiesOut.push(...armorBuy.newSas);
        extraLeft = armorBuy.extraLeft;
      }
    }

    if (input.buyParryingWeaponSa && inputIncludesParryingWeapon(input)) {
      const mergedAfter = new Set(specialAbilitiesOut.map((s) => s.id));
      const parryIds = orderedGenerationParryingWeaponSaIds(mergedAfter, allowSaHighTiers, input);
      if (parryIds.length > 0) {
        const parryBuy = purchaseApSaChain(
          parryIds,
          attrsFinal,
          specialAbilitiesOut,
          extraLeft,
          notes,
          { dbg },
        );
        specialAbilitiesOut.push(...parryBuy.newSas);
        extraLeft = parryBuy.extraLeft;
      }
    }
  }

  if (saPurchaseFirst) {
    dbg(
      `[ShieldArmor] pass=before_veteran (extraAp≥${SA_AP_PURCHASE_FIRST_THRESHOLD}) extraLeft=${extraLeft}`,
    );
    applyShieldAndArmorSaAp();
  }

  /** Veteran AP: spending profile slices + pooled talent/ZfW default loop. */
  const apSpendTalentIds = Array.from(talentTp.keys()).sort(() => rng() - 0.5);

  /** One veteran roulette step respecting `budgetCeiling` (and global `extraLeft`). */
  function runSingleVeteranPick(
    mode: VeteranSpendMode,
    budgetCeiling: number,
  ): boolean {
    const ceiling = Math.min(extraLeft, budgetCeiling);
    if (ceiling <= 0) return false;

    type VeteranAction =
      | { kind: "spell"; index: number; cost: number }
      | {
          kind: "talent";
          id: string;
          spend: NonNullable<ReturnType<typeof computeTalentSpend>>;
        };

    const actions: VeteranAction[] = [];
    const actionWeights: number[] = [];

    const allowSpells =
      mode !== "talents_only" &&
      fullMagic &&
      spells.length > 0 &&
      (mode === "spells_only" || spellGroupWeightForVeteran > 0);

    if (allowSpells) {
      for (let i = 0; i < spells.length; i++) {
        const row = spells[i]!;
        const spellDef = SPELL_DEF_BY_ID.get(row.id);
        if (!spellDef) continue;
        const cap = calculateSpellMaxSp(spellDef, attrsFinal, spellRole, "veteran");
        if (row.sp >= cap) continue;
        const spellCol = spellColumnFor(
          spellDef,
          spellRole,
          houseSpellIds,
          leadSpellIds,
          elvishWorldView,
        );
        const stepCost = spellAdvancementStepCost(
          cols,
          spellCol,
          row.sp,
          row.sp + 1,
        );
        if (stepCost <= 0 || stepCost > ceiling) continue;
        const groupFactor =
          mode === "spells_only" ? 1 : spellGroupWeightForVeteran;
        const w = spellStepPickWeight(
          input.spellPriorities?.[row.id],
          groupFactor,
          rng,
        );
        actions.push({ kind: "spell", index: i, cost: stepCost });
        actionWeights.push(w);
      }
    }

    const allowTalents = mode !== "spells_only";
    if (allowTalents) {
      const talentCandidates = apSpendTalentIds.filter((id) =>
        computeTalentSpend(
          id,
          talentTp,
          cols,
          attrsFinal,
          activationsRemaining,
          ceiling,
          advantageIdsForTalentCap,
          "veteran",
        ),
      );
      for (const id of talentCandidates) {
        const spend = computeTalentSpend(
          id,
          talentTp,
          cols,
          attrsFinal,
          activationsRemaining,
          ceiling,
          advantageIdsForTalentCap,
          "veteran",
        )!;
        const w = talentStepPickWeight(
          rng,
          id,
          groupWeights,
          talentBias,
          talentAvoid,
          weaponFocus,
        );
        actions.push({ kind: "talent", id, spend });
        actionWeights.push(w);
      }
    }

    if (actions.length === 0) return false;

    const wTotal = actionWeights.reduce((a, b) => a + b, 0);
    let rr = rng() * wTotal;
    let pick = actions[actions.length - 1]!;
    for (let i = 0; i < actions.length; i++) {
      rr -= actionWeights[i]!;
      if (rr <= 0) {
        pick = actions[i]!;
        break;
      }
    }

    if (pick.kind === "spell") {
      const row = spells[pick.index]!;
      row.sp += 1;
      extraLeft -= pick.cost;
      dbg(
        `[VeteranAP:${mode}] "${row.name}" SP+1 (−${pick.cost} AP, ceiling≤${ceiling}) → ${extraLeft} AP remaining`,
      );
    } else {
      extraLeft -= pick.spend.cost;
      if (pick.spend.usesNewActivation) activationsRemaining--;
      talentTp.set(pick.id, pick.spend.nextTp);
      dbg(
        `[VeteranAP:${mode}] talent ${pick.id} (−${pick.spend.cost} AP, ceiling≤${ceiling}) nextTp=${pick.spend.nextTp}${pick.spend.usesNewActivation ? " +activation" : ""} → ${extraLeft} AP remaining`,
      );
    }
    return true;
  }

  /** Spend up to `budget` AP via repeated picks (`mode`). Returns unspent reservation. */
  function veteranDrainTalentSpellBucket(
    budget: number,
    mode: VeteranSpendMode,
  ): number {
    let remaining = budget;
    let apGuards = 0;
    while (remaining > 0 && extraLeft > 0 && apGuards++ < 80_000) {
      const before = extraLeft;
      const progressed = runSingleVeteranPick(mode, remaining);
      if (!progressed) break;
      remaining -= before - extraLeft;
    }
    return remaining;
  }

  const conceptAttrBias = (weights.attribute_bias ??
    {}) as Partial<Record<AttrCode, number>>;

  function collectPriorityAttrsForPurchasableSas(): Set<AttrCode> {
    const need = new Set<AttrCode>();
    const merged = new Set(specialAbilitiesOut.map((s) => s.id));

    const addAttrMinsForSaId = (saId: string) => {
      const def = SA_BY_ID.get(saId);
      if (!def) return;
      for (const raw of def.requirements ?? []) {
        const rq = raw as { type?: string; attr?: string; value?: number };
        if (rq.type === "attr_min" && rq.attr && typeof rq.value === "number") {
          const ac = rq.attr as AttrCode;
          const have = attrsFinal[ac] ?? 0;
          if (have < rq.value) need.add(ac);
        }
      }
    };

    for (const id of orderedGenerationShieldSaIds(merged, allowSaHighTiers, input)) {
      if (!merged.has(id)) addAttrMinsForSaId(id);
    }

    if (input.buyArmorUseSa && pickArmorUseOneNoteForInput(input)) {
      for (const id of orderedGenerationArmorSaIds(allowSaHighTiers)) {
        if (!merged.has(id)) addAttrMinsForSaId(id);
      }
    }

    if (input.buyParryingWeaponSa && inputIncludesParryingWeapon(input)) {
      for (const id of orderedGenerationParryingWeaponSaIds(merged, allowSaHighTiers, input)) {
        if (!merged.has(id)) addAttrMinsForSaId(id);
      }
    }

    for (const def of specialAbilitiesData.special_abilities) {
      if (!def.ap_cost || typeof def.ap_cost !== "number") continue;
      if (merged.has(def.id)) continue;
      if (!isChainUpgradeSa(def, merged)) continue;
      for (const raw of def.requirements ?? []) {
        const rq = raw as { type?: string; attr?: string; value?: number };
        if (rq.type === "attr_min" && rq.attr && typeof rq.value === "number") {
          const ac = rq.attr as AttrCode;
          const have = attrsFinal[ac] ?? 0;
          if (have < rq.value) need.add(ac);
        }
      }
    }
    return need;
  }

  /** Veterann attribute raises (column H). Returns unspent portion of `bucket`. */
  function veteranSpendAttrsBucket(bucket: number): number {
    let remaining = bucket;
    while (remaining > 0 && extraLeft > 0) {
      const priority = collectPriorityAttrsForPurchasableSas();
      type Cand = { attr: AttrCode; cost: number; priority: boolean };
      const cands: Cand[] = [];
      for (const a of ATTR_CODES) {
        const v = purchased[a];
        if (v >= MAX_PURCHASED_ATTR_FOR_VETERAN) continue;
        const already = (attrsFinal[a] ?? 0) - (creationStartFinal[a] ?? 0);
        const maxZukauf = Math.round((creationStartFinal[a] ?? 0) / 2);
        if (already >= maxZukauf) continue;
        const c = computePurchasedAttrStepCostPurchased(v);
        if (c === null || c > extraLeft || c > remaining) continue;
        cands.push({ attr: a, cost: c, priority: priority.has(a) });
      }
      if (cands.length === 0) break;
      const pri = cands.filter((c) => c.priority);
      const pool = pri.length ? pri : cands;
      const pickedAttr = weightedPickAttr(
        rng,
        pool.map((c) => c.attr),
        conceptAttrBias,
      );
      const chosen = pool.find((c) => c.attr === pickedAttr) ?? pool[0]!;
      purchased[chosen.attr] += 1;
      extraLeft -= chosen.cost;
      remaining -= chosen.cost;
      refreshAttrsFromPurchased();
      dbg(
        `[VeteranAP:Attributes] raise ${chosen.attr} to purchased=${purchased[chosen.attr]} cost=${chosen.cost} AP (${extraLeft} AP left, bucket ${remaining} remainder)`,
      );
    }
    return remaining;
  }

  /** Across all veteran SA slices — capped combat-maneuver roots. */
  let maneuverRootsBought = 0;
  const maxManeuverRoots = extraApBudget >= 2000 ? 2 : 1;

  /** Generation-needed shield/armor chains first, then maneuver roots, then chain upgrades. Returns unused bucket. */
  function veteranSpendSaBucket(bucket: number): number {
    let remaining = bucket;

    function trySpendGenerationNeededInBucket(): boolean {
      const cap = Math.min(extraLeft, remaining);
      if (cap <= 0) return false;
      let progressed = false;

      const mergedShield = new Set(specialAbilitiesOut.map((s) => s.id));
      const shieldIds = orderedGenerationShieldSaIds(
        mergedShield,
        allowSaHighTiers,
        input,
      );
      if (shieldIds.length > 0) {
        const rShield = purchaseApSaChain(
          shieldIds,
          attrsFinal,
          specialAbilitiesOut,
          cap,
          notes,
          { dbg },
        );
        if (rShield.newSas.length > 0) {
          specialAbilitiesOut.push(...rShield.newSas);
          const spent = cap - rShield.extraLeft;
          extraLeft -= spent;
          remaining -= spent;
          progressed = true;
        }
      }

      const capArmor = Math.min(extraLeft, remaining);
      if (capArmor > 0 && input.buyArmorUseSa) {
        const armorNote = pickArmorUseOneNoteForInput(input);
        if (armorNote) {
          const armorIds = orderedGenerationArmorSaIds(allowSaHighTiers);
          const rArmor = purchaseApSaChain(
            armorIds,
            attrsFinal,
            specialAbilitiesOut,
            capArmor,
            notes,
            { armorUseINote: armorNote, dbg },
          );
          if (rArmor.newSas.length > 0) {
            specialAbilitiesOut.push(...rArmor.newSas);
            const spentA = capArmor - rArmor.extraLeft;
            extraLeft -= spentA;
            remaining -= spentA;
            progressed = true;
          }
        }
      }

      const capParry = Math.min(extraLeft, remaining);
      if (capParry > 0 && input.buyParryingWeaponSa && inputIncludesParryingWeapon(input)) {
        const mergedParry = new Set(specialAbilitiesOut.map((s) => s.id));
        const parryIds = orderedGenerationParryingWeaponSaIds(mergedParry, allowSaHighTiers, input);
        if (parryIds.length > 0) {
          const rParry = purchaseApSaChain(
            parryIds,
            attrsFinal,
            specialAbilitiesOut,
            capParry,
            notes,
            { dbg },
          );
          if (rParry.newSas.length > 0) {
            specialAbilitiesOut.push(...rParry.newSas);
            const spentP = capParry - rParry.extraLeft;
            extraLeft -= spentP;
            remaining -= spentP;
            progressed = true;
          }
        }
      }

      return progressed;
    }

    const MANEUVER_ELIGIBLE_PROFILES = new Set([
      "frontline_fighter",
      "combat_chain_fighter",
      "combat_skirmisher",
      "combat_talent_duelist",
      "blessed_warrior",
    ]);

    function professionEligibleForManeuverRoots(): boolean {
      const combatW =
        typeof (weights.talent_group_weights as Record<string, number> | undefined)
          ?.combat_talents === "number"
          ? (weights.talent_group_weights as Record<string, number>).combat_talents
          : 0;
      if (combatW >= 0.15) return true;
      if ((profession as { category?: string }).category === "combat") return true;
      const profileId =
        input.resolvedApSpendingProfile?.id ?? input.apProfileId ?? "";
      return MANEUVER_ELIGIBLE_PROFILES.has(profileId);
    }

    function collectManeuverRootCandidates(
      owned: Set<string>,
    ): (typeof specialAbilitiesData.special_abilities)[number][] {
      if (!professionEligibleForManeuverRoots()) return [];
      if (weaponLinkedCombatIds.size === 0) return [];

      const preferred = new Set<string>();
      const disc = (profession as { discounted_SAs?: { id?: string }[] })
        .discounted_SAs;
      if (Array.isArray(disc)) {
        for (const item of disc) {
          const id = typeof item?.id === "string" ? resolveSaId(item.id) : "";
          if (id) preferred.add(id);
        }
      }
      for (const id of MANEUVER_ROOT_ALLOWLIST) preferred.add(id);

      const combatW =
        typeof (weights.talent_group_weights as Record<string, number> | undefined)
          ?.combat_talents === "number"
          ? (weights.talent_group_weights as Record<string, number>).combat_talents
          : 0;
      if (extraApBudget >= 2000 && combatW >= 0.3) {
        preferred.add("combat_reflexes");
      }
      if (extraApBudget >= 2000) {
        preferred.add("sharpshooter");
      }

      const out: (typeof specialAbilitiesData.special_abilities)[number][] = [];
      for (const id of preferred) {
        if (owned.has(id)) continue;
        const def = SA_BY_ID.get(id);
        if (!def || typeof def.ap_cost !== "number") continue;
        // Allowlisted roots may still list sa_required (e.g. Formation → Alertness).
        let prereqBlocked = false;
        for (const raw of def.requirements ?? []) {
          const r = raw as { type?: string; sa?: string };
          if (r.type === "sa_required" && r.sa && !owned.has(resolveSaId(r.sa))) {
            prereqBlocked = true;
            break;
          }
        }
        if (prereqBlocked) continue;
        if (!saFitsWeaponLoadout(id, weaponLinkedCombatIds)) continue;
        const incomp = def.incompatible_with ?? [];
        if (incomp.some((cid: string) => owned.has(cid))) continue;
        let attrBlocked = false;
        for (const raw of def.requirements ?? []) {
          const rq = raw as { type?: string; attr?: string; value?: number };
          if (
            rq.type === "attr_min" &&
            rq.attr &&
            typeof rq.value === "number"
          ) {
            const ac = rq.attr as AttrCode;
            if ((attrsFinal[ac] ?? 0) < rq.value) {
              attrBlocked = true;
              break;
            }
          }
        }
        if (attrBlocked) continue;
        out.push(def);
      }
      out.sort((a, b) => {
        const score = (id: string) => {
          if (id === "feint_sa") {
            const light = [...weaponLinkedCombatIds].some((t) =>
              ["fencing_weapons", "daggers", "sabers"].includes(t),
            );
            return light ? 0 : 2;
          }
          if (id === "called_attack_sa") {
            const heavy = [...weaponLinkedCombatIds].some((t) =>
              [
                "axes_and_maces",
                "two_handed_swords",
                "two_handed_blunt_weapons",
                "chain_weapons",
                "infantry_weapons",
                "bastard_sword",
              ].includes(t),
            );
            return heavy ? 0 : 2;
          }
          return 1;
        };
        const ds = score(a.id) - score(b.id);
        if (ds !== 0) return ds;
        return a.ap_cost - b.ap_cost;
      });
      return out;
    }

    const allowAnyRoot = extraApBudget >= 500;

    function tryBuyOneManeuverRoot(): boolean {
      if (!allowAnyRoot) return false;
      if (maneuverRootsBought >= maxManeuverRoots) return false;
      const owned = new Set(specialAbilitiesOut.map((s) => s.id));
      const rootCandidates = collectManeuverRootCandidates(owned);
      if (rootCandidates.length === 0) return false;

      for (const def of rootCandidates) {
        const room = Math.min(extraLeft, remaining);
        if (room < def.ap_cost) continue;
        const rBuy = purchaseApSaChain(
          [def.id],
          attrsFinal,
          specialAbilitiesOut,
          room,
          notes,
          { dbg },
        );
        if (rBuy.newSas.length === 0) continue;
        specialAbilitiesOut.push(...rBuy.newSas);
        const spent = room - rBuy.extraLeft;
        extraLeft -= spent;
        remaining -= spent;
        maneuverRootsBought += rBuy.newSas.length;
        dbg(
          `[VeteranAP:SA:Root] bought ${def.name ?? def.id} (−${spent} AP) roots=${maneuverRootsBought}/${maxManeuverRoots}`,
        );
        return true;
      }
      return false;
    }

    let guardSa = 0;
    while (remaining > 0 && extraLeft > 0 && guardSa++ < 2000) {
      if (trySpendGenerationNeededInBucket()) continue;
      if (tryBuyOneManeuverRoot()) continue;

      const owned = new Set(specialAbilitiesOut.map((s) => s.id));

      type Def = (typeof specialAbilitiesData.special_abilities)[number];
      const candidates: Def[] = [];
      for (const def of specialAbilitiesData.special_abilities) {
        if (!def.ap_cost || typeof def.ap_cost !== "number") continue;
        if (owned.has(def.id)) continue;
        // Loadout-gated roots are bought only via tryBuyOneManeuverRoot.
        if (
          (MANEUVER_ROOT_ALLOWLIST as readonly string[]).includes(def.id) ||
          def.id === "sharpshooter"
        ) {
          continue;
        }
        if (!isChainUpgradeSa(def, owned)) continue;
        const incomp = def.incompatible_with ?? [];
        if (incomp.some((cid: string) => owned.has(cid))) continue;
        let attrBlocked = false;
        for (const raw of def.requirements ?? []) {
          const rq = raw as { type?: string; attr?: string; value?: number };
          if (
            rq.type === "attr_min" &&
            rq.attr &&
            typeof rq.value === "number"
          ) {
            const ac = rq.attr as AttrCode;
            if ((attrsFinal[ac] ?? 0) < rq.value) {
              attrBlocked = true;
              break;
            }
          }
        }
        if (attrBlocked) continue;
        candidates.push(def);
      }

      candidates.sort((a, b) => a.ap_cost - b.ap_cost);

      let progressed = false;
      for (const def of candidates) {
        const capTry = Math.min(extraLeft, remaining);
        const rBuy = purchaseApSaChain(
          [def.id],
          attrsFinal,
          specialAbilitiesOut,
          capTry,
          notes,
          { dbg },
        );
        if (rBuy.newSas.length === 0) continue;
        progressed = true;
        specialAbilitiesOut.push(...rBuy.newSas);
        const spentB = capTry - rBuy.extraLeft;
        extraLeft -= spentB;
        remaining -= spentB;
        break;
      }
      if (!progressed) break;
    }

    return remaining;
  }

  const resolvedProfile =
    input.resolvedApSpendingProfile ?? loadBundledDefaultApProfile();
  const profileBandsSorted = sortBandsByFrom(resolvedProfile.bands ?? []);

  dbg(
    `[AP_Profile] id=${resolvedProfile.id} name="${resolvedProfile.name}" bands=${profileBandsSorted.length}`,
  );

  if (extraApBudget > 0 && profileBandsSorted.length > 0) {
    const slices = groupOrdinalSlices(extraApBudget, profileBandsSorted);
    let carryPool = 0;
    let sliceOrdinal = 0;
    for (const slice of slices) {
      sliceOrdinal++;
      const sliceSize = slice.toOrdinal - slice.fromOrdinal + 1;
      const pool = carryPool + sliceSize;
      carryPool = 0;

      let pTalents = slice.band.talents ?? 0;
      let pSpells = slice.band.spells ?? 0;
      if (
        pSpells > 0 &&
        !(fullMagic && spells.length > 0)
      ) {
        notes.push(
          "Veteran AP profile: spell budget redirected to talents (non-caster or no spells on sheet).",
        );
        pTalents += pSpells;
        pSpells = 0;
      }

      let bucketAttr = Math.floor((pool * (slice.band.attributes ?? 0)) / 100);
      let bucketSa = Math.floor((pool * (slice.band.special_abilities ?? 0)) / 100);
      let bucketTalents = Math.floor((pool * pTalents) / 100);
      let bucketSpells = Math.floor((pool * pSpells) / 100);
      const bucketDefault =
        pool - bucketAttr - bucketSa - bucketTalents - bucketSpells;

      dbg(
        `[AP_Profile:Slice ${sliceOrdinal}] AP ordinals=${slice.fromOrdinal}-${slice.toOrdinal} sliceSize=${sliceSize} slicePool=${pool} band attributes=${slice.band.attributes ?? 0}% SA=${slice.band.special_abilities ?? 0}% talents=${pTalents}% spells=${pSpells}% → bucketAttr=${bucketAttr} bucketSA=${bucketSa} bucketTalents=${bucketTalents} bucketSpells=${bucketSpells} bucketDefault=${bucketDefault}`,
      );

      const rAttrRemain = veteranSpendAttrsBucket(bucketAttr);
      bucketSa += rAttrRemain;

      const rSaRemain = veteranSpendSaBucket(bucketSa);
      bucketTalents += rSaRemain;

      const rTalRemain = veteranDrainTalentSpellBucket(bucketTalents, "talents_only");
      bucketSpells += rTalRemain;

      const rSpellRemain = veteranDrainTalentSpellBucket(bucketSpells, "spells_only");
      const nextDefBudget = bucketDefault + rSpellRemain;

      carryPool = veteranDrainTalentSpellBucket(nextDefBudget, "mixed");

      dbg(
        `[AP_Profile:Slice ${sliceOrdinal}] end extraLeft=${extraLeft} carryPool(default→next)=${carryPool}`,
      );
    }
  } else if (extraApBudget > 0) {
    dbg(
      `[AP_Profile] no banded profile (${profileBandsSorted.length} bands)-using default mixed veteran pool`,
    );
    let apGuards = 0;
    while (extraLeft > 0 && apGuards++ < 80_000) {
      type VeteranAction =
        | { kind: "spell"; index: number; cost: number }
        | {
            kind: "talent";
            id: string;
            spend: NonNullable<ReturnType<typeof computeTalentSpend>>;
          };

      const actions: VeteranAction[] = [];
      const actionWeights: number[] = [];

      if (fullMagic && spells.length > 0 && spellGroupWeightForVeteran > 0) {
        for (let i = 0; i < spells.length; i++) {
          const row = spells[i]!;
          const spellDef = SPELL_DEF_BY_ID.get(row.id);
          if (!spellDef) continue;
          const cap = calculateSpellMaxSp(spellDef, attrsFinal, spellRole, "veteran");
          if (row.sp >= cap) continue;
          const spellCol = spellColumnFor(
            spellDef,
            spellRole,
            houseSpellIds,
            leadSpellIds,
            elvishWorldView,
          );
          const stepCost = spellAdvancementStepCost(
            cols,
            spellCol,
            row.sp,
            row.sp + 1,
          );
          if (stepCost <= 0 || stepCost > extraLeft) continue;
          const w = spellStepPickWeight(
            input.spellPriorities?.[row.id],
            spellGroupWeightForVeteran,
            rng,
          );
          actions.push({ kind: "spell", index: i, cost: stepCost });
          actionWeights.push(w);
        }
      }

      const talentCandidates = apSpendTalentIds.filter((id) => {
        const spend = computeTalentSpend(
          id,
          talentTp,
          cols,
          attrsFinal,
          activationsRemaining,
          extraLeft,
          advantageIdsForTalentCap,
          "veteran",
        );
        return spend !== null;
      });
      for (const id of talentCandidates) {
        const spend = computeTalentSpend(
          id,
          talentTp,
          cols,
          attrsFinal,
          activationsRemaining,
          extraLeft,
          advantageIdsForTalentCap,
          "veteran",
        )!;
        const w = talentStepPickWeight(
          rng,
          id,
          groupWeights,
          talentBias,
          talentAvoid,
          weaponFocus,
        );
        actions.push({ kind: "talent", id, spend });
        actionWeights.push(w);
      }

      if (actions.length === 0) break;

      const wTotal = actionWeights.reduce((a, b) => a + b, 0);
      let r = rng() * wTotal;
      let pick = actions[actions.length - 1]!;
      for (let i = 0; i < actions.length; i++) {
        r -= actionWeights[i]!;
        if (r <= 0) {
          pick = actions[i]!;
          break;
        }
      }

      if (pick.kind === "spell") {
        const row = spells[pick.index]!;
        row.sp += 1;
        extraLeft -= pick.cost;
        dbg(
          `[VeteranAP:default_pool] spell "${row.name}" SP+1 (−${pick.cost} AP) → ${extraLeft} AP remaining`,
        );
      } else {
        extraLeft -= pick.spend.cost;
        if (pick.spend.usesNewActivation) activationsRemaining--;
        talentTp.set(pick.id, pick.spend.nextTp);
        dbg(
          `[VeteranAP:default_pool] talent ${pick.id} (−${pick.spend.cost} AP) nextTp=${pick.spend.nextTp} → ${extraLeft} AP remaining`,
        );
      }
    }
  } else {
    dbg("[VeteranAP] skip profile/default spend (extraApBudget=0)");
  }

  dbg(
    `[VeteranAP] after profile/default loop: ${extraLeft} AP remaining of ${extraApBudget} (${extraApBudget - extraLeft} spent)`,
  );

  if (!saPurchaseFirst) {
    dbg(
      `[ShieldArmor] pass=after_veteran (extraAp<${SA_AP_PURCHASE_FIRST_THRESHOLD}) extraLeft=${extraLeft}`,
    );
    applyShieldAndArmorSaAp();
  }

  /**
   * Veteran AP may have raised `purchased` base attributes → `attrsFinal`; keep `derived`
   * (VP/EP/WT/baseAT/basePA/baseBRV/baseINI/RM/ASP) in sync before stacking residual VP/ASP.
   */
  refreshAttrsFromPurchased();

  const residualVpAsp = trySpendResidualVpAsp(
    extraApBudget,
    extraLeft,
    fullMagic,
    notes,
    dbg,
  );
  extraLeft = residualVpAsp.extraLeft;
  derived.VP += residualVpAsp.vpDelta;
  derived.ASP += residualVpAsp.aspDelta;

  const allTraitIds = new Set([
    ...automaticAdvantages.map((t) => t.id),
    ...automaticDisadvantages.map((t) => t.id),
    ...chosenAdvantages.map((t) => t.id),
    ...chosenDisadvantages.map((t) => t.id),
  ]);
  derived.GS = computeGroundSpeed(attrsFinal.AG, allTraitIds);

  for (const [id, tp] of talentTp.entries()) {
    const def = TALENT_INDEX.get(id);
    if (!def) continue;
    talentRows.push({
      id,
      name: def.name,
      group: def.group,
      tp,
      testAttributes: def.test_attributes ?? [],
      advancementColumn: def.advancement_column ?? "D",
      isBasic: def.is_basic,
    });
  }

  const combatMelee: CharacterSheet["combatMelee"] = [];
  const combatRanged: CharacterSheet["combatRanged"] = [];
  const professionAtPaBias = normalizeConceptAtPaBias(weights.at_pa_bias);
  const finalAttributeSumPurchased = ATTR_CODES.reduce(
    (s, code) => s + purchased[code],
    0,
  );
  for (const [id, tp] of talentTp.entries()) {
    const def = TALENT_INDEX.get(id);
    if (!def || tp <= 0) continue;
    if (def.combat_type === "melee") {
      const meleeBias = meleeBiasForTalentFromWeapons(id, weaponBiasRows, professionAtPaBias);
      const { allocatedAT: at, allocatedPA: pa } = allocateMeleeCombatTp(tp, meleeBias);
      combatMelee.push({
        talentId: id,
        talentName: def.name,
        tp,
        allocatedAT: at,
        allocatedPA: pa,
        finalAT: derived.baseAT + at,
        finalPA: derived.basePA + pa,
        combatType: "melee",
      });
    } else if (def.combat_type === "ranged") {
      combatRanged.push({
        talentId: id,
        talentName: def.name,
        tp,
        finalAT: derived.baseBRV + tp,
      });
    }
  }

  const nameEntry =
    cultureNames.by_culture[culture.id as keyof typeof cultureNames.by_culture];
  let displayName = "Unnamed";
  if (nameEntry) {
    const male = nameEntry.first_names_male ?? [];
    const female = nameEntry.first_names_female ?? [];
    const unisex = (nameEntry as { unisex_names?: string[] }).unisex_names ?? [];
    let firstPool: string[] = [];
    if (unisex.length > 0 && male.length === 0 && female.length === 0) {
      firstPool = unisex;
    } else {
      firstPool =
        gender === "male"
          ? male.length
            ? male
            : female
          : female.length
            ? female
            : male;
    }
    if (firstPool.length > 0) {
      const first = pick(rng, firstPool);
      const lastNames = nameEntry.last_names ?? [];
      const last = lastNames.length > 0 ? pick(rng, lastNames) : "";
      displayName = last ? `${first} ${last}` : first;
    }
  }

  const ageYears = rollRaceAgeYears(rng, race.id, {
    timeConsuming: Boolean(profession.time_consuming) || automaticAdvantages.some((t) => t.id === "academic_training" && /scholar|gelehrt/i.test(t.note ?? "")),
    educatedRating,
  });
  const fallbackHeight = approximateHeightCm(rng, race.id);
  const appearance = rollRaceAppearance(
    rng,
    race.id,
    (race as { physical_appearance?: Parameters<typeof rollRaceAppearance>[2] }).physical_appearance,
    fallbackHeight,
  );

  const header = {
    displayName,
    raceId: race.id,
    raceName: race.name,
    cultureId: culture.id,
    cultureName: culture.name,
    professionId: profession.id,
    professionName: profession.name,
    ...(weights.category ? { professionCategory: weights.category } : {}),
    gender,
    ageYears,
  };

  const loadout = resolveLoadout(input);

  removeStaleInsufficientApSaNotes(specialAbilitiesOut, notes);

  dbg(
    `[Done] gpEnd=${gp} AP_unused=${extraLeft}/${extraApBudget} notes_lines=${notes.length} SA_count=${specialAbilitiesOut.length} talents_final=${talentRows.length} spells_final=${spells.length}`,
  );

  const sheet: CharacterSheet = {
    schemaVersion: 1,
    header,
    attributesPurchased: purchased,
    attributesFinal: attrsFinal,
    derived,
    automaticAdvantages,
    automaticDisadvantages,
    chosenAdvantages,
    chosenDisadvantages,
    specialAbilities: specialAbilitiesOut,
    talents: talentRows,
    spells,
    combatMelee,
    combatRanged,
    startingEquipment: profession.starting_equipment ?? [],
    startingMoneySilbertaler: so * so,
    physical: {
      heightCm: appearance.heightCm,
      weightKg: appearance.weightKg,
      hair: appearance.hair,
      eyes: appearance.eyes,
    },
    budgets: {
      gpStart: GP_START,
      gpEnd: gp,
      raceGp,
      cultureGp,
      professionGp,
      attributeSumPurchased: finalAttributeSumPurchased,
      soExtraGp,
      extraApApplied: extraApBudget - extraLeft,
      tgpTotal,
      tgpSpent,
      sgpTotal,
      sgpSpent,
      tgpConvertedToSgp: 0,
    },
    ...(loadout ? { loadout } : {}),
    atPaBias: professionAtPaBias,
    notes,
    ...(input.debugMode ? { debugLog } : {}),
  };

  return sheet;
}
