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
  /** Approximate until a dedicated Kampftechnik row exists */
  shields: "fencing_weapons",
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

function armorIniSum(armors: SheetLoadoutArmor[]): number {
  return armors.reduce((s, a) => s + (typeof a.iniModifier === "number" ? a.iniModifier : 0), 0);
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
  weaponBiasContext: WeaponBiasRow[] = []
): LoadoutWeaponCombatLine {
  const list = armors ?? [];
  const totalEC = totalLoadoutEC(list);
  const shield = sumShieldModifiers(list);
  const talentRaw = weapon.combatTalent ?? null;
  /** Sheet combat rows use canonical KT ids from the talent catalog. */
  const talentId = canonicalCombatTalentId(talentRaw);
  const def = talentId ? COMBAT_TALENT_MAP.get(talentId) : undefined;
  const combatType = def?.combat_type ?? "unknown";
  const eec = def?.eec;
  const ebe = parseEffectiveEncumbrance(eec, totalEC);
  const meleeSplit = encumbranceSplitMelee(ebe);
  const notes: string[] = [];

  const tp = talentTp(sheet, talentId);
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
    damage: weapon.damage,
    notes,
  };
}

export function computeAllLoadoutWeaponLines(
  sheet: CharacterSheet,
  loadout: SheetLoadout
): LoadoutWeaponCombatLine[] {
  const armors = loadout.armors;
  const weaponBiasContext = loadoutWeaponsToBiasRows(loadout.weapons ?? []);
  return (loadout.weapons ?? []).map((w) =>
    computeLoadoutWeaponLine(sheet, w, armors, weaponBiasContext)
  );
}
