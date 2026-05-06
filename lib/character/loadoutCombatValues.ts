/**
 * Loadout combat display: final AT/PA/INI from sheet + weapon + armor/shield + encumbrance (EEC/eBE).
 * Melee eBE split: floor to AT, ceil to PA (odd remainder hits PA). Ranged/jousting: full eBE from AT.
 * EC is summed over all chosen armor rows (simplified stacking).
 */

import combatTalentsData from "@/data/talents/combat_talents.json";
import {
  allocateMeleeCombatTp,
  meleeBiasForTalentFromWeapons,
  normalizeConceptAtPaBias,
  type WeaponBiasRow,
} from "@/lib/character/meleeTpAllocation";
import type {
  CharacterSheet,
  SheetLoadout,
  SheetLoadoutArmor,
  SheetLoadoutWeapon,
} from "@/lib/character/types";
import {
  resolveWeaponDamageAtStrength,
  tpKkForLoadoutWeapon,
  weaponDamageStrengthNote,
} from "@/lib/combat/weaponDamageAtStrength";

const SHIELD_WEAPON_IDS = new Set([
  /** Known shield weapon ids; same list as weapons.json is_shield rows + legacy loadouts. */
  "buckler",
  "small_shield",
  "battle_shield",
  "thorwaler_shield",
  "great_shield",
  "leather_shield",
  "large_leather_shield",
]);

type CombatTalentJson = {
  id: string;
  eec?: string;
  combat_type?: string;
};

const COMBAT_TALENT_MAP = new Map<string, CombatTalentJson>(
  (combatTalentsData.talents as CombatTalentJson[]).map((t) => [t.id, t]),
);

/** `weapons.json` uses shorter slugs in places; canonical ids live in combat_talents.json. */
const WEAPON_COMBAT_TALENT_ALIASES: Record<string, string> = {
  bastard_swords: "bastard_sword",
  discus: "throwing_knives",
  blowpipes: "bows",
};

function canonicalCombatTalentId(
  raw: string | undefined | null,
): string | null {
  if (raw == null || raw === "") return null;
  if (COMBAT_TALENT_MAP.has(raw)) return raw;
  const target = WEAPON_COMBAT_TALENT_ALIASES[raw];
  if (target && COMBAT_TALENT_MAP.has(target)) return target;
  return null;
}

function isShieldLoadoutWeapon(w: SheetLoadoutWeapon): boolean {
  if (w.isShield === true) return true;
  if (w.combatTalent === "shields") return true;
  return SHIELD_WEAPON_IDS.has(w.id);
}

/** Talents that use two-handed weapons incompatible with shield WM on the same line. */
const MELEE_NO_SHIELD_TALENTS = new Set([
  "two_handed_swords",
  "two_handed_blunt_weapons",
  "staves",
  "infantry_weapons",
  "bastard_sword",
]);

/** Untrained / fallback combat (BRW): −5 total as AT−2, PA−3 vs bases. */
function fallbackMeleeBases(sheet: CharacterSheet): { at: number; pa: number } {
  return {
    at: sheet.derived.baseAT - 2,
    pa: sheet.derived.basePA - 3,
  };
}

function talentTp(sheet: CharacterSheet, talentId: string | null): number {
  if (!talentId) return 0;
  const row = sheet.talents.find((t) => t.id === talentId);
  return row?.tp ?? 0;
}

/**
 * Effective encumbrance (eBE) for a combat talent from total worn EC (BE).
 */
export function parseEffectiveEncumbrance(
  eecRaw: string | undefined,
  totalEC: number
): number {
  const raw = (eecRaw ?? "EC").trim();
  if (!raw || raw === "0") return 0;
  const u = raw.toUpperCase();
  if (u === "EC") return Math.max(0, totalEC);
  const sub = /^EC-(\d+)$/i.exec(raw);
  if (sub) return Math.max(0, totalEC - Number(sub[1]));
  if (/^ECX2$/i.test(u)) return Math.max(0, totalEC * 2);
  return Math.max(0, totalEC);
}

function encumbranceSplitMelee(ebe: number): { atPen: number; paPen: number } {
  return {
    atPen: Math.floor(ebe / 2),
    paPen: Math.ceil(ebe / 2),
  };
}

function sumShieldModifiers(armors: SheetLoadoutArmor[]): {
  at: number;
  pa: number;
} {
  let at = 0;
  let pa = 0;
  for (const a of armors) {
    if (a.category !== "shield") continue;
    if (typeof a.atModifier === "number") at += a.atModifier;
    if (typeof a.paModifier === "number") pa += a.paModifier;
  }
  return { at, pa };
}

/** Shield WM from armor rows plus other shield weapons (excludes the current weapon row). */
function sumCompanionShieldModifiers(
  armors: SheetLoadoutArmor[] | undefined,
  allWeapons: SheetLoadoutWeapon[],
  currentWeaponId: string,
): { at: number; pa: number } {
  const arm = sumShieldModifiers(armors ?? []);
  let at = arm.at;
  let pa = arm.pa;
  for (const w of allWeapons) {
    if (!isShieldLoadoutWeapon(w) || w.id === currentWeaponId) continue;
    at += w.atModifier;
    pa += w.paModifier;
  }
  return { at, pa };
}

/** PA bonus from Off-hand Fighting + Shield Fighting I/II (data/character/special_abilities.json). */
const SHIELD_PAR_SA_BONUS: Record<string, number> = {
  off_hand_fighting: 1,
  shield_fighting_i: 2,
  shield_fighting_ii: 2,
};

function shieldParrySaBonus(sheet: CharacterSheet): number {
  const ids = new Set(sheet.specialAbilities.map((x) => x.id));
  let s = 0;
  for (const [saId, bonus] of Object.entries(SHIELD_PAR_SA_BONUS)) {
    if (ids.has(saId)) s += bonus;
  }
  return s;
}

function armorIniSum(armors: SheetLoadoutArmor[]): number {
  return armors.reduce((s, a) => s + (typeof a.iniModifier === "number" ? a.iniModifier : 0), 0);
}

function loadoutWeaponDamageFields(
  sheet: CharacterSheet,
  weapon: SheetLoadoutWeapon,
): { damage: string | undefined; damageStrengthNote: string | undefined } {
  const raw = weapon.damage?.trim();
  if (!raw) return { damage: undefined, damageStrengthNote: undefined };
  const st = sheet.attributesFinal.ST;
  const tpKk = tpKkForLoadoutWeapon(weapon.id, weapon.tpKk);
  const resolved = resolveWeaponDamageAtStrength(st, raw, tpKk);
  const n = weaponDamageStrengthNote(resolved, st);
  return {
    damage: resolved.display,
    damageStrengthNote: n || undefined,
  };
}

export type LoadoutWeaponCombatLine = {
  weaponId: string;
  weaponName: string;
  kind: "melee" | "ranged" | "jousting" | "unknown";
  combatTalentId: string | null;
  totalEC: number;
  ebe: number;
  baseAT: number;
  basePA: number | null;
  weaponAT: number;
  weaponPA: number;
  shieldAT: number;
  shieldPA: number;
  encumbranceAT: number;
  encumbrancePA: number;
  finalAT: number;
  finalPA: number | null;
  ini: number;
  damage?: string;
  /** Present when codex TP/ST scaling applies (see `tp_kk` / loadout `tpKk`). */
  damageStrengthNote?: string;
  notes: string[];
};

export function totalLoadoutEC(armors: SheetLoadoutArmor[] | undefined): number {
  if (!armors?.length) return 0;
  return armors.reduce((s, a) => s + (typeof a.ec === "number" ? a.ec : 0), 0);
}

function loadoutWeaponsToBiasRows(weapons: SheetLoadoutWeapon[]): WeaponBiasRow[] {
  return weapons.map((w) => ({
    combatTalent: canonicalCombatTalentId(w.combatTalent),
    atModifier: w.atModifier,
    paModifier: w.paModifier,
  }));
}

function meleeBasesFromTp(
  sheet: CharacterSheet,
  meleeRow: NonNullable<CharacterSheet["combatMelee"][number]>,
  talentId: string,
  weaponBiasContext: WeaponBiasRow[],
  notes: string[]
): { baseAT: number; basePA: number } {
  const conceptBias = normalizeConceptAtPaBias(sheet.atPaBias);
  const meleeBias =
    weaponBiasContext.length > 0
      ? meleeBiasForTalentFromWeapons(talentId, weaponBiasContext, conceptBias)
      : conceptBias;
  const split = allocateMeleeCombatTp(meleeRow.tp, meleeBias);
  if (
    split.allocatedAT !== meleeRow.allocatedAT ||
    split.allocatedPA !== meleeRow.allocatedPA
  ) {
    notes.push(
      "Melee TP split from Σ(PA−AT) WM on chosen weapons for this talent (concept tie-break if neutral); may differ from combat table if loadout changed."
    );
  }
  return {
    baseAT: sheet.derived.baseAT + split.allocatedAT,
    basePA: sheet.derived.basePA + split.allocatedPA,
  };
}

export function computeLoadoutWeaponLine(
  sheet: CharacterSheet,
  weapon: SheetLoadoutWeapon,
  armors: SheetLoadoutArmor[] | undefined,
  weaponBiasContext: WeaponBiasRow[] = [],
  companionShieldMod?: { at: number; pa: number },
): LoadoutWeaponCombatLine {
  const list = armors ?? [];
  const totalEC = totalLoadoutEC(list);
  const shield =
    companionShieldMod ?? sumShieldModifiers(list);

  const notes: string[] = [];

  /** Shield weapons: no Kampftechnik talent — parry = base PA + shield WM + Shield Fighting / Off-hand SA. */
  if (isShieldLoadoutWeapon(weapon)) {
    const ebeShield = parseEffectiveEncumbrance("EC", totalEC);
    const splitShield = encumbranceSplitMelee(ebeShield);
    const saPa = shieldParrySaBonus(sheet);
    const baseAT = sheet.derived.baseAT;
    const basePA = sheet.derived.basePA + saPa;
    notes.push(
      "Shield: parry uses base PA + shield WM + encumbrance + Off-hand Fighting / Shield Fighting SA (no combat talent TP).",
    );

    const dmgFields = loadoutWeaponDamageFields(sheet, weapon);

    return {
      weaponId: weapon.id,
      weaponName: weapon.name,
      kind: "melee",
      combatTalentId: null,
      totalEC,
      ebe: ebeShield,
      baseAT,
      basePA,
      weaponAT: weapon.atModifier,
      weaponPA: weapon.paModifier,
      shieldAT: 0,
      shieldPA: 0,
      encumbranceAT: splitShield.atPen,
      encumbrancePA: splitShield.paPen,
      finalAT: baseAT + weapon.atModifier - splitShield.atPen,
      finalPA: basePA + weapon.paModifier - splitShield.paPen,
      ini:
        sheet.derived.baseINI +
        armorIniSum(list) +
        (typeof weapon.iniModifier === "number" ? weapon.iniModifier : 0),
      ...dmgFields,
      notes,
    };
  }

  const talentRaw = weapon.combatTalent ?? null;
  /** Sheet combat rows use canonical KT ids from the talent catalog. */
  const talentId = canonicalCombatTalentId(talentRaw);
  const def = talentId ? COMBAT_TALENT_MAP.get(talentId) : undefined;
  const combatType = def?.combat_type ?? "unknown";
  const eec = def?.eec;
  const ebe = parseEffectiveEncumbrance(eec, totalEC);
  const meleeSplit = encumbranceSplitMelee(ebe);

  const meleeRow = talentId
    ? sheet.combatMelee.find((r) => r.talentId === talentId)
    : undefined;
  const rangedRow = talentId
    ? sheet.combatRanged.find((r) => r.talentId === talentId)
    : undefined;

  let kind: LoadoutWeaponCombatLine["kind"] = "unknown";
  let baseAT = sheet.derived.baseAT;
  let basePA: number | null = sheet.derived.basePA;
  let encAT = meleeSplit.atPen;
  let encPA = meleeSplit.paPen;

  const allowsShield =
    combatType === "melee" &&
    !!talentId &&
    !MELEE_NO_SHIELD_TALENTS.has(talentId);

  let shieldAT = allowsShield ? shield.at : 0;
  let shieldPA = allowsShield ? shield.pa : 0;
  if (!allowsShield && (shield.at !== 0 || shield.pa !== 0)) {
    notes.push("Shield modifiers omitted (two-handed / incompatible talent).");
  }

  if (combatType === "ranged") {
    kind = "ranged";
    basePA = null;
    encAT = ebe;
    encPA = 0;
    shieldAT = 0;
    shieldPA = 0;
    if (rangedRow) {
      baseAT = rangedRow.finalAT;
    } else {
      const tp = talentTp(sheet, talentId);
      baseAT = sheet.derived.baseBRV + tp;
      if (tp <= 0) {
        notes.push("No ranged TP on sheet; FK base + 0 TP shown.");
      }
    }
  } else if (combatType === "jousting") {
    kind = "jousting";
    basePA = null;
    encAT = ebe;
    encPA = 0;
    shieldAT = 0;
    shieldPA = 0;
    const tp = talentTp(sheet, talentId);
    baseAT = sheet.derived.baseAT + tp;
    if (meleeRow) {
      notes.push("Jousting uses AT-only; sheet melee row ignored.");
    }
  } else if (combatType === "melee") {
    kind = "melee";
    if (meleeRow && talentId) {
      const mb = meleeBasesFromTp(sheet, meleeRow, talentId, weaponBiasContext, notes);
      baseAT = mb.baseAT;
      basePA = mb.basePA;
    } else if (meleeRow) {
      baseAT = meleeRow.finalAT;
      basePA = meleeRow.finalPA;
    } else {
      const fb = fallbackMeleeBases(sheet);
      baseAT = fb.at;
      basePA = fb.pa;
      notes.push("No melee TP row; fallback AT−2 / PA−3 vs bases.");
    }
  } else {
    if (meleeRow && talentId) {
      kind = "melee";
      const mb = meleeBasesFromTp(sheet, meleeRow, talentId, weaponBiasContext, notes);
      baseAT = mb.baseAT;
      basePA = mb.basePA;
    } else if (meleeRow) {
      kind = "melee";
      baseAT = meleeRow.finalAT;
      basePA = meleeRow.finalPA;
    } else if (rangedRow) {
      kind = "ranged";
      baseAT = rangedRow.finalAT;
      basePA = null;
      encAT = ebe;
      encPA = 0;
      shieldAT = 0;
      shieldPA = 0;
    } else {
      notes.push("Unknown combat talent; bases + weapon mods only.");
    }
  }

  const finalAT =
    baseAT + weapon.atModifier + shieldAT - encAT;
  const finalPA =
    basePA === null ? null : basePA + weapon.paModifier + shieldPA - encPA;

  const ini =
    sheet.derived.baseINI +
    armorIniSum(list) +
    (typeof weapon.iniModifier === "number" ? weapon.iniModifier : 0);

  const dmgFields = loadoutWeaponDamageFields(sheet, weapon);

  return {
    weaponId: weapon.id,
    weaponName: weapon.name,
    kind,
    combatTalentId: talentId ?? talentRaw,
    totalEC,
    ebe,
    baseAT,
    basePA,
    weaponAT: weapon.atModifier,
    weaponPA: weapon.paModifier,
    shieldAT,
    shieldPA,
    encumbranceAT: encAT,
    encumbrancePA: encPA,
    finalAT,
    finalPA,
    ini,
    ...dmgFields,
    notes,
  };
}

export function computeAllLoadoutWeaponLines(
  sheet: CharacterSheet,
  loadout: SheetLoadout
): LoadoutWeaponCombatLine[] {
  const armors = loadout.armors;
  const allWeapons = loadout.weapons ?? [];
  const weaponBiasContext = loadoutWeaponsToBiasRows(allWeapons);
  return allWeapons.map((w) =>
    computeLoadoutWeaponLine(
      sheet,
      w,
      armors,
      weaponBiasContext,
      sumCompanionShieldModifiers(armors, allWeapons, w.id),
    )
  );
}
