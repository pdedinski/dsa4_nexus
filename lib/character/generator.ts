import racesData from "@/data/core/races.json";
import culturesData from "@/data/core/cultures.json";
import professionsData from "@/data/core/professions.json";
import spellsData from "@/data/magic/spells.json";
import disadvantagesData from "@/data/character/disadvantages.json";
import advantagesData from "@/data/character/advantages.json";
import advancementCosts from "@/data/meta/advancement_costs.json";
import conceptWeights from "@/data/concepts/concept_weights.json";
import cultureNames from "@/data/names/culture_names.json";
import armorData from "@/data/equipment/armor.json";
import weaponsData from "@/data/equipment/weapons.json";
import { ALL_TALENT_IDS, TALENT_INDEX } from "@/lib/talents/catalog";
import { mergeTalentModifiersNormalized } from "@/lib/talents/modifierNormalization";

import {
  spellActivationCost,
  spellAdvancementStepCost,
  talentActivationCost,
  talentStepsCost,
} from "./advancement";
import type {
  AttrCode,
  CharacterSheet,
  ConceptId,
  GenerateCharacterInput,
  SheetLoadout,
  SheetLoadoutArmor,
  SheetLoadoutWeapon,
  SpellPriority,
} from "./types";
import { ATTR_CODES } from "./types";
import {
  allocateMeleeCombatTp,
  meleeBiasForTalentFromWeapons,
  normalizeConceptAtPaBias,
  type WeaponBiasRow,
} from "./meleeTpAllocation";

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

/** True elven peoples for profession requirements that still encode `"race":"elf"`. */
export const ELF_KIND_PROFESSION_RACE_IDS = new Set([
  "elf",
  "forest_elf",
  "firn_elf",
]);

export function satisfiesProfessionRaceRequirement(
  requirementRaceId: string,
  heroRaceId: string,
): boolean {
  if (requirementRaceId === heroRaceId) return true;
  return (
    requirementRaceId === "elf" &&
    ELF_KIND_PROFESSION_RACE_IDS.has(heroRaceId)
  );
}

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
      combatTalent: w.combat_talent ?? null,
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
      combatTalent: w.combat_talent ?? null,
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

/** Per-talent multipliers from concept_weights (stacked on group weight). */
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
 * Optional per-concept downweights for TGP picks: multiply pick weight (after talent_bias).
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
  const bias = talentBias ?? {};
  const avoid = talentAvoid ?? {};
  const ws = candidateIds.map((id) => {
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
          // Ranged-only loadout: melee type entirely unrepresented.
          w *= WEAPON_FOCUS_UNSELECTED_TYPE_FACTOR;
        } else if (weaponFocus.melee.size > 0 && !weaponFocus.melee.has(id)) {
          // Melee represented but this specific talent wasn't chosen.
          w *= WEAPON_FOCUS_OFF_TYPE_FACTOR;
        }
      } else if (isRanged) {
        if (weaponFocus.ranged.size === 0 && weaponFocus.melee.size > 0) {
          // Melee-only loadout: ranged type entirely unrepresented.
          w *= WEAPON_FOCUS_UNSELECTED_TYPE_FACTOR;
        } else if (weaponFocus.ranged.size > 0 && !weaponFocus.ranged.has(id)) {
          // Ranged represented but this specific talent wasn't chosen.
          w *= WEAPON_FOCUS_OFF_TYPE_FACTOR;
        }
      }
    }
    return Math.max(0.05, w);
  });
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
function computeTalentSpend(
  id: string,
  talentTp: Map<string, number>,
  cols: (typeof advancementCosts)["talent_columns"]["columns"],
  attrsFinal: CharacterSheet["attributesFinal"],
  activationsRemaining: number,
  budget: number,
  advantageIds: ReadonlySet<string>
): { cost: number; nextTp: number; usesNewActivation: boolean } | null {
  const def = TALENT_INDEX.get(id);
  if (!def?.advancement_column) return null;
  const col = def.advancement_column;
  const maxTp = creationMaxTalentTp(def, attrsFinal, advantageIds);
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

const WEAPON_LOADOUT_MIN_COMBAT_TALENT_TP = 1;

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
        `Cannot complete generation: your chosen weapons require "${def.name}" (${id}) at TaW ${minTp}, but with this hero's attributes the creation maximum for that talent is only ${cap}.`,
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
          cur === undefined ? "not yet learned" : `currently TaW ${cur}`;
        throw new Error(
          `Cannot complete generation: your chosen weapons require combat talent "${def.name}" (${id}) at least at TaW ${minTp} (${curLabel}), but there are not enough creation resources left — ` +
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
 * determines starting money (SO × SO Silbertaler). This function generates a
 * biased SO roll that respects both the profession's legal range and the
 * concept's intended social tier.
 *
 * If the concept carries a `social_standing_bias` with `so_min`/`so_max`, the
 * final SO is clamped to the intersection of profession range and concept range,
 * then picked from a weighted distribution favouring the upper part of that
 * intersection (so higher-status concepts spend GP toward comfortable SO).
 */
function generateSo(
  rng: () => number,
  profRange: { min: number; max: number },
  conceptSoBias: { so_min: number; so_max: number } | null,
): number {
  const lo = profRange.min;
  const hi = profRange.max;
  if (lo >= hi) return lo;

  if (!conceptSoBias) {
    // Uniform fallback — slightly centre-weighted.
    return Math.min(hi, Math.max(lo, Math.round(lo + rng() * (hi - lo))));
  }

  // Intersect concept preference with profession legality.
  const prefLo = Math.max(lo, conceptSoBias.so_min);
  const prefHi = Math.min(hi, conceptSoBias.so_max);

  if (prefLo > prefHi) {
    // No overlap: fall back to clamped concept midpoint inside profession range.
    const mid = Math.round((conceptSoBias.so_min + conceptSoBias.so_max) / 2);
    return Math.min(hi, Math.max(lo, mid));
  }

  // Draw from two‑segment distribution: 75 % of probability mass in the
  // preferred window, 25 % spread across the rest of the profession range.
  const usePreferred = rng() < 0.75;
  if (usePreferred) {
    return Math.min(prefHi, Math.max(prefLo, Math.round(prefLo + rng() * (prefHi - prefLo))));
  }
  // Remaining mass: draw uniformly from the full profession range, then
  // clamp away from the preferred window to avoid double-counting.
  const raw = Math.round(lo + rng() * (hi - lo));
  if (raw >= prefLo && raw <= prefHi) {
    // Re-map into the full range outside preferred window.
    const below = prefLo - lo;
    const above = hi - prefHi;
    if (below === 0 && above === 0) return prefLo;
    const pivot = rng() * (below + above);
    return pivot < below ? lo + Math.floor(pivot) : prefHi + 1 + Math.floor(pivot - below);
  }
  return Math.min(hi, Math.max(lo, raw));
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

function solveAttributes(
  rng: () => number,
  minsNeeded: Partial<Record<AttrCode, number>>,
  bias: Partial<Record<AttrCode, number>>
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
  let sum = ATTR_CODES.reduce((s, a) => s + base[a], 0);
  const maxSum = 100;
  while (sum < maxSum) {
    const pool = ATTR_CODES.filter((a) => base[a] < 14);
    if (pool.length === 0) break;
    pool.sort(
      (a, b) => (bias[b] ?? 0) + rng() * 0.1 - ((bias[a] ?? 0) + rng() * 0.1)
    );
    const a = pool[0]!;
    base[a]++;
    sum++;
  }
  return base;
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
  const row = racesData.races.find((r) => r.id === raceId);
  if (row?.magic_status === "full_caster") return true;
  if (raceId === "half_elf" && halfElfFullCaster) return true;
  return false;
}

function spellApplicable(
  spell: (typeof spellsData.spells)[0],
  role: "guild_magician" | "elf"
): boolean {
  const tr = spell.traditions ?? [];
  if (role === "guild_magician")
    return tr.includes("guild_magic") || tr.includes("general");
  return tr.includes("elven_heritage") || tr.includes("general");
}

function maxStartingSpForSpell(
  spell: (typeof spellsData.spells)[0],
  role: "guild_magician" | "elf"
): number {
  const tr = spell.traditions ?? [];
  if (role === "guild_magician") {
    if (tr.includes("elven_heritage") && !tr.includes("guild_magic"))
      return Math.min(
        spell.max_starting_sp ?? 7,
        advancementCosts.spell_columns.max_starting_sp
          .guild_magician_elven_spells
      );
    return Math.min(
      spell.max_starting_sp ?? 10,
      advancementCosts.spell_columns.max_starting_sp.guild_magician_guild_spells
    );
  }
  if (tr.includes("elven_heritage"))
    return Math.min(
      spell.max_starting_sp ?? 10,
      advancementCosts.spell_columns.max_starting_sp.elf_elven_heritage_spells
    );
  return Math.min(
    spell.max_starting_sp ?? 10,
    advancementCosts.spell_columns.max_starting_sp.elf_general_spells
  );
}

/** Base weight for spell pick ordering; 0 = excluded unless fallback activates. */
function spellPriorityBase(p?: SpellPriority): number {
  if (p === "high") return 3;
  if (p === "medium") return 2;
  if (p === "low") return 1;
  return 0;
}

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
  halfElfFullCaster: boolean
): { id: string; name: string; description: string; traditions: string[] }[] {
  if (!isFullCaster(raceId, professionId, halfElfFullCaster)) return [];
  const isGuildMagician = professionId === "magician";
  const spellRole: "guild_magician" | "elf" = isGuildMagician
    ? "guild_magician"
    : "elf";
  return spellsData.spells
    .filter((s) => spellApplicable(s, spellRole))
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      traditions: s.traditions ?? [],
    }));
}

export function generateCharacter(
  input: GenerateCharacterInput,
  seed?: number
): CharacterSheet {
  const rng = mulberry32(seed ?? Date.now() % 2147483647);
  const notes: string[] = [];

  const conceptPool = Object.keys(conceptWeights.concepts) as ConceptId[];
  const concept: ConceptId =
    input.conceptId === "random"
      ? pick(rng, conceptPool.filter((c) => c !== "any")) || "any"
      : (input.conceptId as ConceptId);
  const weights =
    conceptWeights.concepts[concept] ?? conceptWeights.concepts.any;
  const advantagePickBias = normalizeTraitPickBias(
    (weights as Record<string, unknown>).advantage_pick_bias
  );
  const disadvantagePickBias = normalizeTraitPickBias(
    (weights as Record<string, unknown>).disadvantage_pick_bias
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
      ? pick(rng, profs.length ? profs : professionsData.professions)
      : professionsData.professions.find((p) => p.id === input.professionId)!;
  if (!profession || !cultureAllowsProfession(culture, profession.id)) {
    profession = pick(rng, profs.length ? profs : professionsData.professions);
    notes.push("Profession invalid for culture; picked compatible profession.");
  }

  const halfElfFullCaster = Boolean(input.halfElfFullCaster);
  let raceGp = race.gp_cost ?? 0;
  if (race.id === "half_elf" && halfElfFullCaster) raceGp += 8;

  const cultureGp = culture.gp_cost ?? 0;
  const professionGp = profession.gp_cost ?? 0;

  const soRange = professionSoRange(profession);
  const conceptSoBias =
    (weights as { social_standing_bias?: { so_min: number; so_max: number } })
      .social_standing_bias ?? null;
  const so = generateSo(rng, soRange, conceptSoBias);
  const soExtraGp = Math.max(0, so - soRange.min);

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

  const purchased = solveAttributes(
    rng,
    minsAfterMods,
    (weights.attribute_bias ?? {}) as Partial<Record<AttrCode, number>>
  );
  const attrSum = ATTR_CODES.reduce((s, a) => s + purchased[a], 0);

  let gp =
    GP_START -
    raceGp -
    cultureGp -
    professionGp -
    attrSum -
    soExtraGp;

  const chosenAdvantages: CharacterSheet["chosenAdvantages"] = [];
  const chosenDisadvantages: CharacterSheet["chosenDisadvantages"] = [];

  const disPool = disadvantagesData.disadvantages.filter(
    (d) =>
      !d.auto_only &&
      typeof d.gp_refund === "number" &&
      !d.is_leveled &&
      !d.is_magical
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
    return true;
  };

  const advPool = advantagesData.advantages.filter(
    (a): a is typeof a & { gp_cost: number } =>
      !a.auto_only &&
      typeof a.gp_cost === "number" &&
      a.gp_cost > 0 &&
      a.gp_cost <= 12
  );

  while (gp < 0) {
    if (!tryDis()) {
      notes.push("Could not balance GP deficit with disadvantages; clamping.");
      gp = 0;
      break;
    }
  }
  while (gp > 0 && advPool.length) {
    const affordable = advPool.filter((a) => a.gp_cost <= gp);
    if (!affordable.length) break;
    const a = pickWeightedByIdBias(rng, affordable, advantagePickBias);
    chosenAdvantages.push({ id: a.id, name: a.name });
    gp -= a.gp_cost;
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
      `GP not fully spent (${gp} left); add advantages manually or lower attributes.`
    );

  const advantageIdsForTalentCap = new Set(
    chosenAdvantages.map((a) => a.id)
  );

  const attrsFinalRecord = applyAttrMods(purchased, race, culture);
  const attrsFinal = { ...attrsFinalRecord, SO: so } as CharacterSheet["attributesFinal"];

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
  const profRm = (profession.derived_modifiers as { RM?: number } | undefined)?.RM ?? 0;
  const RM =
    Math.round((CO + CL + CN) / 5) +
    (race.derived_modifiers?.RM ?? 0) +
    cultRm +
    profRm;
  const fullMagic = isFullCaster(race.id, profession.id, halfElfFullCaster);
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

  const mergedTalents = mergeTalentModifiersNormalized(rng, race, culture, profession);
  const weaponBiasRows = collectWeaponBiasRows(input);
  const weaponLinkedCombatIds = collectWeaponLinkedCombatTalentIds(input);
  const tgpTotal = (CL + IN) * 20;
  let tgpLeft = tgpTotal;
  const talentRows: CharacterSheet["talents"] = [];
  const talentTp = new Map<string, number>();
  for (const [id, mod] of Object.entries(mergedTalents)) {
    talentTp.set(id, mod);
  }
  clampTalentTpMapToCreationMax(talentTp, attrsFinal, advantageIdsForTalentCap);
  const cols = advancementCosts.talent_columns.columns;
  const groupWeights = weights.talent_group_weights as
    | Record<string, number>
    | undefined;
  const talentBias: Record<string, number> = {
    ...normalizeTalentBias(weights.talent_bias),
  };
  // Strong bias toward combat talents that match chosen weapons (primary + secondary_talents).
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

  const talentAvoid = normalizeTalentAvoidBias(
    (weights as Record<string, unknown>).talent_avoid_bias
  );

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

  let tgpGuards = 0;
  while (tgpLeft > 0 && tgpGuards++ < 150_000) {
    const candidates = spendPool.filter((id) => {
      const spend = computeTalentSpend(
        id,
        talentTp,
        cols,
        attrsFinal,
        activationsRemaining,
        tgpLeft,
        advantageIdsForTalentCap
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
      advantageIdsForTalentCap
    )!;
    tgpLeft -= spend.cost;
    if (spend.usesNewActivation) activationsRemaining--;
    talentTp.set(id, spend.nextTp);
  }

  const spells: CharacterSheet["spells"] = [];
  let sgpTotal = (CL + IN) * 5;
  let sgpLeft = sgpTotal;
  let tgpConverted = 0;
  const maxConvert = (CL + IN) * 10;
  const isGuildMagician = profession.id === "magician";
  const spellRole: "guild_magician" | "elf" = isGuildMagician
    ? "guild_magician"
    : "elf";

  if (fullMagic) {
    const pool = spellsData.spells.filter((s) => spellApplicable(s, spellRole));
    type Scored = { s: (typeof pool)[0]; w: number; base: number };
    const scored: Scored[] = pool.map((s) => {
      const base = spellPriorityBase(input.spellPriorities?.[s.id]);
      return { s, base, w: base + rng() * 0.01 };
    });
    let ranked = scored.filter((x) => x.base > 0);
    if (ranked.length === 0) {
      notes.push(
        "All applicable spells were marked None for random allocation; used the full list with equal weight."
      );
      ranked = scored.map((x) => ({
        s: x.s,
        base: 1,
        w: 1 + rng() * 0.01,
      }));
    }
    ranked.sort((a, b) => b.w - a.w);
    const maxActs = advancementCosts.spell_columns.max_activations_at_creation;
    let acts = 0;
    for (const { s } of ranked) {
      if (acts >= maxActs) break;
      const col = s.advancement_column ?? "A";
      const act = spellActivationCost(
        advancementCosts.spell_columns.columns,
        col,
        isGuildMagician
      );
      if (act > sgpLeft) {
        const short = act - sgpLeft;
        const take = Math.min(short, tgpLeft, maxConvert - tgpConverted);
        if (take < short) continue;
        tgpLeft -= take;
        tgpConverted += take;
        sgpLeft += take;
      }
      if (act > sgpLeft) continue;
      sgpLeft -= act;
      acts++;
      const maxSp = maxStartingSpForSpell(s, spellRole);
      let sp = 0;
      while (sp < maxSp) {
        const step = spellAdvancementStepCost(
          advancementCosts.spell_columns.columns,
          col,
          sp,
          sp + 1
        );
        if (step > sgpLeft) {
          const need = step - sgpLeft;
          const take = Math.min(need, tgpLeft, maxConvert - tgpConverted);
          if (take < need) break;
          tgpLeft -= take;
          tgpConverted += take;
          sgpLeft += take;
        }
        if (step > sgpLeft) break;
        sgpLeft -= step;
        sp++;
      }
      spells.push({
        id: s.id,
        name: s.name,
        sp,
        tradition: (s.traditions ?? []).join(","),
        advancementColumn: col,
      });
    }
  }

  /** Total TGP removed from pool: talents, activations, and TGP→SGP conversion. */
  const tgpSpent = tgpTotal - tgpLeft;

  const sgpSpent = sgpTotal + tgpConverted - sgpLeft;

  const extraApBudget = Math.max(0, Math.floor(input.extraAp ?? 0));
  let extraLeft = extraApBudget;
  /** Post-creation AP may only improve talents already on this hero (not the full catalog). */
  const apSpendTalentIds = Array.from(talentTp.keys()).sort(() => rng() - 0.5);
  let apGuards = 0;
  while (extraLeft > 0 && apGuards++ < 80_000) {
    const candidates = apSpendTalentIds.filter((id) => {
      const spend = computeTalentSpend(
        id,
        talentTp,
        cols,
        attrsFinal,
        activationsRemaining,
        extraLeft,
        advantageIdsForTalentCap
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
      extraLeft,
      advantageIdsForTalentCap
    )!;
    extraLeft -= spend.cost;
    if (spend.usesNewActivation) activationsRemaining--;
    talentTp.set(id, spend.nextTp);
  }

  clampTalentTpMapToCreationMax(talentTp, attrsFinal, advantageIdsForTalentCap);

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
  const conceptBias = normalizeConceptAtPaBias(weights.at_pa_bias);
  for (const [id, tp] of talentTp.entries()) {
    const def = TALENT_INDEX.get(id);
    if (!def || tp <= 0) continue;
    if (def.combat_type === "melee") {
      const meleeBias = meleeBiasForTalentFromWeapons(id, weaponBiasRows, conceptBias);
      const { allocatedAT: at, allocatedPA: pa } = allocateMeleeCombatTp(tp, meleeBias);
      combatMelee.push({
        talentId: id,
        talentName: def.name,
        tp,
        allocatedAT: at,
        allocatedPA: pa,
        finalAT: baseAT + at,
        finalPA: basePA + pa,
        combatType: "melee",
      });
    } else if (def.combat_type === "ranged") {
      combatRanged.push({
        talentId: id,
        talentName: def.name,
        tp,
        finalAT: baseBRV + tp,
      });
    }
  }

  const gender =
    input.gender === "random" || !input.gender
      ? rng() < 0.5
        ? "male"
        : "female"
      : input.gender;

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

  const ageYears = 16 + Math.floor(rng() * 20) + (profession.time_consuming ? 3 : 0);
  const { heightCm, weightOffsetKg } = approximateHeightCm(rng, race.id);
  const weightKg = Math.max(35, heightCm - weightOffsetKg);

  const header = {
    displayName,
    conceptId: concept,
    raceId: race.id,
    raceName: race.name,
    cultureId: culture.id,
    cultureName: culture.name,
    professionId: profession.id,
    professionName: profession.name,
    gender,
    ageYears,
  };

  const loadout = resolveLoadout(input);

  const sheet: CharacterSheet = {
    schemaVersion: 1,
    header,
    attributesPurchased: purchased,
    attributesFinal: attrsFinal,
    derived: {
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
    },
    automaticAdvantages: (race.automatic_advantages ?? []) as CharacterSheet["automaticAdvantages"],
    automaticDisadvantages: [
      ...((race.automatic_disadvantages ?? []) as CharacterSheet["automaticDisadvantages"]),
      ...((culture.automatic_disadvantages ?? []) as CharacterSheet["automaticDisadvantages"]),
    ],
    chosenAdvantages,
    chosenDisadvantages,
    specialAbilities: [
      ...((race.automatic_SAs ?? []) as CharacterSheet["specialAbilities"]),
      ...((culture.automatic_SAs ?? []) as CharacterSheet["specialAbilities"]),
      ...((profession.automatic_SAs ?? []) as CharacterSheet["specialAbilities"]),
    ],
    talents: talentRows,
    spells,
    combatMelee,
    combatRanged,
    startingEquipment: profession.starting_equipment ?? [],
    startingMoneySilbertaler: so * so,
    physical: {
      heightCm,
      weightKg,
      hair: "see race tables",
      eyes: "see race tables",
    },
    budgets: {
      gpStart: GP_START,
      gpEnd: gp,
      raceGp,
      cultureGp,
      professionGp,
      attributeSumPurchased: attrSum,
      soExtraGp,
      extraApApplied: extraApBudget - extraLeft,
      tgpTotal,
      tgpSpent,
      sgpTotal,
      sgpSpent,
      tgpConvertedToSgp: tgpConverted,
    },
    ...(loadout ? { loadout } : {}),
    atPaBias: conceptBias,
    notes,
  };

  return sheet;
}
