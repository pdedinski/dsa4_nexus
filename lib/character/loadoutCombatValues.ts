/**
 * Loadout combat AT/PA/INI: applies combat talent **EEC** to worn **EC** (after Armor Use) → **effective EC**.
 * Melee: ⌊effective EC/2⌋ from AT, ⌈effective EC/2⌉ from PA.
 * Ranged / jousting: full effective EC from AT.
 */

import combatTalentsData from "@/data/talents/combat_talents.json";
import weaponsDataForParry from "@/data/equipment/weapons.json";
import {
  allocateMeleeCombatTp,
  meleeBiasForTalentFromWeapons,
  normalizeConceptAtPaBias,
  type WeaponBiasRow,
} from "@/lib/character/meleeTpAllocation";
import {
  computeLoadoutEncumbranceTotals,
  parseEffectiveEncumbrance,
  totalLoadoutECRaw,
  type LoadoutEncumbranceTotals,
} from "@/lib/character/encumbrance";
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

export { parseEffectiveEncumbrance } from "@/lib/character/encumbrance";

const SHIELD_WEAPON_IDS = new Set([
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

function isParryingLoadoutWeapon(w: SheetLoadoutWeapon): boolean {
  const def = (weaponsDataForParry.weapons as Array<{ id: string; is_parrying_weapon?: boolean }>).find(
    (x) => x.id === w.id,
  );
  return def?.is_parrying_weapon === true;
}

/** Parierwaffen in codex often omit `combat_talent`; Dolche applies (WdS Linkhand/Hakendolch rows). */
function meleeCombatTalentIdForWeapon(w: SheetLoadoutWeapon): {
  talentId: string | null;
  inferredDaggersForParrying: boolean;
} {
  const prior = canonicalCombatTalentId(w.combatTalent);
  if (prior) return { talentId: prior, inferredDaggersForParrying: false };
  if (isParryingLoadoutWeapon(w)) {
    return {
      talentId: canonicalCombatTalentId("daggers"),
      inferredDaggersForParrying: true,
    };
  }
  return { talentId: null, inferredDaggersForParrying: false };
}

const MELEE_NO_SHIELD_TALENTS = new Set([
  "two_handed_swords",
  "two_handed_blunt_weapons",
  "staves",
  "infantry_weapons",
  "bastard_sword",
]);

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

type ParryingWeaponBonusResult = {
  bonus: number;
  saLevel: "none" | "parrying_weapons_i" | "parrying_weapons_ii";
  parryingWeaponName: string;
  parryingWeaponPv: number;
};

/**
 * Returns the Parrying Weapons SA bonus for a primary (non-parrying) weapon's PA.
 * Looks for a companion parrying weapon in the loadout and the highest tier of
 * Parrying Weapons SA owned by the character.
 *
 * Rules (BRW p.102 / WdS):
 *   Parrying Weapons I:  primary PA += −1 + parrying_weapon_PV
 *   Parrying Weapons II: primary PA += +2 + parrying_weapon_PV
 */
function parryingWeaponSaBonus(
  sheet: CharacterSheet,
  allWeapons: SheetLoadoutWeapon[],
  currentWeaponId: string,
): ParryingWeaponBonusResult {
  const saIds = new Set(sheet.specialAbilities.map((x) => x.id));
  const hasI = saIds.has("parrying_weapons_i");
  const hasII = saIds.has("parrying_weapons_ii");
  if (!hasI && !hasII) {
    return { bonus: 0, saLevel: "none", parryingWeaponName: "", parryingWeaponPv: 0 };
  }

  // Find the best parrying weapon in the loadout (highest PV), exclude current weapon
  let bestPv = 0;
  let bestName = "";
  for (const w of allWeapons) {
    if (w.id === currentWeaponId) continue;
    const def = (weaponsDataForParry.weapons as Array<{ id: string; is_parrying_weapon?: boolean; parrying_weapon_pv?: number; name: string }>).find(
      (x) => x.id === w.id,
    );
    if (!def?.is_parrying_weapon) continue;
    const pv = typeof def.parrying_weapon_pv === "number" ? def.parrying_weapon_pv : 0;
    if (pv > bestPv || (pv === bestPv && bestName === "")) {
      bestPv = pv;
      bestName = w.name;
    }
  }

  if (bestPv === 0 && bestName === "") {
    return { bonus: 0, saLevel: "none", parryingWeaponName: "", parryingWeaponPv: 0 };
  }

  if (hasII) {
    return {
      bonus: 2 + bestPv,
      saLevel: "parrying_weapons_ii",
      parryingWeaponName: bestName,
      parryingWeaponPv: bestPv,
    };
  }
  return {
    bonus: -1 + bestPv,
    saLevel: "parrying_weapons_i",
    parryingWeaponName: bestName,
    parryingWeaponPv: bestPv,
  };
}

function armorIniSum(armors: SheetLoadoutArmor[]): number {
  return armors.reduce(
    (s, a) => s + (typeof a.iniModifier === "number" ? a.iniModifier : 0),
    0,
  );
}

function encDetailEbe(
  eecLabel: string,
  ebe: number,
  rawTotalEC: number,
  effectiveTotalEC: number,
  kind: "melee_split" | "full_at",
  encAT?: number,
  encPA?: number,
): string {
  const parts = [
    `EEC ${eecLabel}`,
    `effective EC ${ebe}`,
    `raw total EC ${rawTotalEC} → after Armor Use ${effectiveTotalEC}`,
  ];
  if (kind === "melee_split" && encAT != null && encPA != null) {
    parts.push(`melee AT −${encAT} / PA −${encPA} (⌊eff. EC/2⌋ / ⌈eff. EC/2⌉)`);
  } else {
    parts.push(`ranged/jousting: full effective EC −${encAT ?? ebe} from AT`);
  }
  return parts.join("; ");
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

function iniLinesFor(
  sheet: CharacterSheet,
  list: SheetLoadoutArmor[],
  weapon: SheetLoadoutWeapon,
): CombatValueBreakdownLine[] {
  const lines: CombatValueBreakdownLine[] = [
    {
      label: "Base INI",
      delta: sheet.derived.baseINI,
      detail: "round((CO+CO+IN+AG)/5) + racial modifier",
    },
  ];
  if (list.length) {
    const sum = armorIniSum(list);
    const detail = list
      .map(
        (a) =>
          `${a.name}: ${a.iniModifier >= 0 ? "+" : ""}${a.iniModifier}`,
      )
      .join("; ");
    lines.push({
      label: "Armor / shield INI",
      delta: sum,
      detail,
    });
  }
  if (typeof weapon.iniModifier === "number" && weapon.iniModifier !== 0) {
    lines.push({
      label: "Weapon INI modifier",
      delta: weapon.iniModifier,
      detail: "Heavy weapons / gear from codex",
    });
  }
  return lines;
}

export type CombatValueBreakdownLine = {
  label: string;
  delta: number;
  detail?: string;
};

export type LoadoutWeaponCombatLine = {
  weaponId: string;
  weaponName: string;
  kind: "melee" | "ranged" | "jousting" | "unknown";
  combatTalentId: string | null;
  /** Sum of worn per-piece codex EC (`ec`) before Armor Use. */
  totalEC: number;
  /** Worn aggregate EC after Armor Use (input to effective EC / EEC). */
  effectiveTotalEC: number;
  ebe: number;
  combatTalentEec?: string;
  baseAT: number;
  basePA: number | null;
  weaponAT: number;
  weaponPA: number;
  shieldAT: number;
  shieldPA: number;
  /** PA bonus from an off-hand parrying weapon (Parrying Weapons I/II SA). 0 when not applicable. */
  parryingWeaponPA: number;
  encumbranceAT: number;
  encumbrancePA: number;
  finalAT: number;
  finalPA: number | null;
  ini: number;
  damage?: string;
  damageStrengthNote?: string;
  notes: string[];
  atBreakdown: CombatValueBreakdownLine[];
  paBreakdown: CombatValueBreakdownLine[] | null;
  iniBreakdown: CombatValueBreakdownLine[];
  armorUseSummary: string;
};

export function totalLoadoutEC(armors: SheetLoadoutArmor[] | undefined): number {
  return totalLoadoutECRaw(armors);
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
  notes: string[],
): { baseAT: number; basePA: number; allocatedAT: number; allocatedPA: number } {
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
      "Melee TP split from Σ(PA−AT) WM on chosen weapons for this talent (concept tie-break if neutral); may differ from combat table if loadout changed.",
    );
  }
  return {
    baseAT: sheet.derived.baseAT + split.allocatedAT,
    basePA: sheet.derived.basePA + split.allocatedPA,
    allocatedAT: split.allocatedAT,
    allocatedPA: split.allocatedPA,
  };
}

export function computeLoadoutWeaponLine(
  sheet: CharacterSheet,
  weapon: SheetLoadoutWeapon,
  armors: SheetLoadoutArmor[] | undefined,
  weaponBiasContext: WeaponBiasRow[] = [],
  companionShieldMod?: { at: number; pa: number },
  encTotalsPre?: LoadoutEncumbranceTotals,
  allLoadoutWeapons?: SheetLoadoutWeapon[],
): LoadoutWeaponCombatLine {
  const list = armors ?? [];
  const encTotals =
    encTotalsPre ??
    computeLoadoutEncumbranceTotals(list, sheet.specialAbilities);
  const rawTotalEC = encTotals.rawTotalEC;
  const effectiveTotalEC = encTotals.effectiveTotalEC;
  const armorUseSummary = encTotals.armorUse.summary;

  if (rawTotalEC !== effectiveTotalEC && armorUseSummary) {
    /* footnote optional — surfaced in breakdown detail */
  }

  const shield =
    companionShieldMod ?? sumShieldModifiers(list);

  const notes: string[] = [];

  const iniBreakdown = iniLinesFor(sheet, list, weapon);

  /** Shield weapons */
  if (isShieldLoadoutWeapon(weapon)) {
    const eecShield = "EC";
    const ebeShield = parseEffectiveEncumbrance(eecShield, effectiveTotalEC);
    const splitShield = encumbranceSplitMelee(ebeShield);
    const saPa = shieldParrySaBonus(sheet);
    const baseAT = sheet.derived.baseAT;
    const basePA = sheet.derived.basePA + saPa;
    notes.push(
      "Shield: parry uses base PA + shield WM + effective EC + SA Off-hand Fighting / Shield Fighting (no shield combat talent TP).",
    );

    const dmgFields = loadoutWeaponDamageFields(sheet, weapon);

    const encDetail = encDetailEbe(
      eecShield,
      ebeShield,
      rawTotalEC,
      effectiveTotalEC,
      "melee_split",
      splitShield.atPen,
      splitShield.paPen,
    );

    const atBreakdown: CombatValueBreakdownLine[] = [
      { label: "Base AT", delta: sheet.derived.baseAT },
      {
        label: "Weapon AT modifier",
        delta: weapon.atModifier,
        detail: "Shield WM (AT)",
      },
      {
        label: "Encumbrance (⌊eff. EC/2⌋ from AT)",
        delta: -splitShield.atPen,
        detail: encDetail + (armorUseSummary ? `; ${armorUseSummary}` : ""),
      },
    ];

    const paBreakdown: CombatValueBreakdownLine[] = [
      { label: "Base PA", delta: sheet.derived.basePA },
      {
        label: "Off-hand / Shield Fighting SA",
        delta: saPa,
        detail: "data/character/special_abilities.json",
      },
      {
        label: "Shield PA modifier",
        delta: weapon.paModifier,
        detail: "Shield WM (PA)",
      },
      {
        label: "Encumbrance (⌈eff. EC/2⌉ from PA)",
        delta: -splitShield.paPen,
        detail: encDetail + (armorUseSummary ? `; ${armorUseSummary}` : ""),
      },
    ];

    return {
      weaponId: weapon.id,
      weaponName: weapon.name,
      kind: "melee",
      combatTalentId: null,
      totalEC: rawTotalEC,
      effectiveTotalEC,
      ebe: ebeShield,
      combatTalentEec: eecShield,
      baseAT,
      basePA,
      weaponAT: weapon.atModifier,
      weaponPA: weapon.paModifier,
      shieldAT: 0,
      shieldPA: 0,
      parryingWeaponPA: 0,
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
      atBreakdown,
      paBreakdown,
      iniBreakdown,
      armorUseSummary,
    };
  }

  const talentRaw = weapon.combatTalent ?? null;
  const { talentId, inferredDaggersForParrying } = meleeCombatTalentIdForWeapon(weapon);
  if (inferredDaggersForParrying) {
    notes.push(
      "Parrying weapon: Dolche (Daggers) talent assumed for melee TP — codex omits combat_talent on this Parierwaffe (same convention as Linkhand/WdS).",
    );
  }
  const def = talentId ? COMBAT_TALENT_MAP.get(talentId) : undefined;
  const combatType = def?.combat_type ?? "unknown";
  const eec = def?.eec;
  const ebe = parseEffectiveEncumbrance(eec, effectiveTotalEC);
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

  const atBreakdown: CombatValueBreakdownLine[] = [];
  let paBreakdown: CombatValueBreakdownLine[] | null = [];

  const allowsShield =
    combatType === "melee" &&
    !!talentId &&
    !MELEE_NO_SHIELD_TALENTS.has(talentId);

  let shieldAT = allowsShield ? shield.at : 0;
  let shieldPA = allowsShield ? shield.pa : 0;
  if (!allowsShield && (shield.at !== 0 || shield.pa !== 0)) {
    notes.push("Shield modifiers omitted (two-handed / incompatible talent).");
  }

  // Parrying Weapons SA bonus: only applies to non-parrying-weapon melee lines
  const parryResult =
    combatType === "melee" && !isParryingLoadoutWeapon(weapon)
      ? parryingWeaponSaBonus(sheet, allLoadoutWeapons ?? [], weapon.id)
      : { bonus: 0, saLevel: "none" as const, parryingWeaponName: "", parryingWeaponPv: 0 };

  let allocatedAT = 0;
  let allocatedPA = 0;

  if (combatType === "ranged") {
    kind = "ranged";
    basePA = null;
    encAT = ebe;
    encPA = 0;
    shieldAT = 0;
    shieldPA = 0;
    const tp = talentTp(sheet, talentId);
    if (rangedRow) {
      baseAT = rangedRow.finalAT;
      atBreakdown.push(
        { label: "Base BRV (FK)", delta: sheet.derived.baseBRV },
        {
          label: "Ranged TP",
          delta: tp,
          detail: rangedRow.talentName,
        },
      );
    } else {
      baseAT = sheet.derived.baseBRV + tp;
      atBreakdown.push(
        { label: "Base BRV (FK)", delta: sheet.derived.baseBRV },
        {
          label: "Ranged TP",
          delta: tp,
          detail: talentId ?? undefined,
        },
      );
      if (tp <= 0) {
        notes.push("No ranged TP on sheet; FK base + 0 TP shown.");
      }
    }
    paBreakdown = null;
  } else if (combatType === "jousting") {
    kind = "jousting";
    basePA = null;
    encAT = ebe;
    encPA = 0;
    shieldAT = 0;
    shieldPA = 0;
    const tp = talentTp(sheet, talentId);
    baseAT = sheet.derived.baseAT + tp;
    atBreakdown.push(
      { label: "Base AT", delta: sheet.derived.baseAT },
      {
        label: "Jousting TP (AT only)",
        delta: tp,
        detail: talentId ?? undefined,
      },
    );
    if (meleeRow) {
      notes.push("Jousting uses AT-only; sheet melee row ignored.");
    }
    paBreakdown = null;
  } else if (combatType === "melee") {
    kind = "melee";
    if (meleeRow && talentId) {
      const mb = meleeBasesFromTp(
        sheet,
        meleeRow,
        talentId,
        weaponBiasContext,
        notes,
      );
      baseAT = mb.baseAT;
      basePA = mb.basePA;
      allocatedAT = mb.allocatedAT;
      allocatedPA = mb.allocatedPA;
      atBreakdown.push(
        { label: "Base AT", delta: sheet.derived.baseAT },
        {
          label: "Melee TP → AT",
          delta: allocatedAT,
          detail: `TP ${meleeRow.tp}; ${meleeRow.talentName}`,
        },
      );
      paBreakdown!.push(
        { label: "Base PA", delta: sheet.derived.basePA },
        {
          label: "Melee TP → PA",
          delta: allocatedPA,
          detail: `TP ${meleeRow.tp}; ${meleeRow.talentName}`,
        },
      );
    } else if (meleeRow) {
      baseAT = meleeRow.finalAT;
      basePA = meleeRow.finalPA;
      allocatedAT = meleeRow.allocatedAT;
      allocatedPA = meleeRow.allocatedPA;
      atBreakdown.push({
        label: "Melee combat table AT",
        delta: baseAT,
        detail: "From sheet (base + allocated AT)",
      });
      paBreakdown!.push({
        label: "Melee combat table PA",
        delta: basePA,
        detail: "From sheet (base + allocated PA)",
      });
    } else {
      const fb = fallbackMeleeBases(sheet);
      baseAT = fb.at;
      basePA = fb.pa;
      atBreakdown.push(
        { label: "Base AT", delta: sheet.derived.baseAT },
        { label: "Untrained AT penalty", delta: -2 },
      );
      paBreakdown!.push(
        { label: "Base PA", delta: sheet.derived.basePA },
        { label: "Untrained PA penalty", delta: -3 },
      );
      notes.push("No melee TP row; fallback AT−2 / PA−3 vs bases.");
    }
  } else {
    if (meleeRow && talentId) {
      kind = "melee";
      const mb = meleeBasesFromTp(
        sheet,
        meleeRow,
        talentId,
        weaponBiasContext,
        notes,
      );
      baseAT = mb.baseAT;
      basePA = mb.basePA;
      allocatedAT = mb.allocatedAT;
      allocatedPA = mb.allocatedPA;
      atBreakdown.push(
        { label: "Base AT", delta: sheet.derived.baseAT },
        {
          label: "Melee TP → AT",
          delta: allocatedAT,
          detail: `TP ${meleeRow.tp}`,
        },
      );
      paBreakdown!.push(
        { label: "Base PA", delta: sheet.derived.basePA },
        {
          label: "Melee TP → PA",
          delta: allocatedPA,
          detail: `TP ${meleeRow.tp}`,
        },
      );
    } else if (meleeRow) {
      kind = "melee";
      baseAT = meleeRow.finalAT;
      basePA = meleeRow.finalPA;
      atBreakdown.push({
        label: "Melee combat table AT",
        delta: baseAT,
      });
      paBreakdown!.push({
        label: "Melee combat table PA",
        delta: basePA,
      });
    } else if (rangedRow) {
      kind = "ranged";
      baseAT = rangedRow.finalAT;
      basePA = null;
      encAT = ebe;
      encPA = 0;
      shieldAT = 0;
      shieldPA = 0;
      const tp = talentTp(sheet, talentId);
      atBreakdown.push(
        { label: "Base BRV (FK)", delta: sheet.derived.baseBRV },
        { label: "Ranged TP", delta: tp },
      );
      paBreakdown = null;
    } else {
      atBreakdown.push({ label: "Base AT", delta: baseAT });
      paBreakdown!.push({ label: "Base PA", delta: basePA ?? 0 });
      notes.push("Unknown combat talent; bases + weapon mods only.");
    }
  }

  const encLbl = eec ?? "—";
  const encDetail =
    kind === "ranged" || kind === "jousting"
      ? encDetailEbe(encLbl, ebe, rawTotalEC, effectiveTotalEC, "full_at", encAT, 0)
      : encDetailEbe(
          encLbl,
          ebe,
          rawTotalEC,
          effectiveTotalEC,
          "melee_split",
          encAT,
          encPA,
        );

  atBreakdown.push({
    label: "Weapon AT modifier",
    delta: weapon.atModifier,
    detail: "WM from codex",
  });
  if (shieldAT !== 0) {
    atBreakdown.push({
      label: "Companion shield AT",
      delta: shieldAT,
      detail: "Shield WM from other hand / armor shield row",
    });
  }
  atBreakdown.push({
    label:
      kind === "ranged" || kind === "jousting"
        ? "Encumbrance (full effective EC from AT)"
        : "Encumbrance (⌊eff. EC/2⌋ from AT)",
    delta: -encAT,
    detail:
      encDetail +
      (armorUseSummary ? `; ${armorUseSummary}` : ""),
  });

  if (paBreakdown) {
    paBreakdown.push({
      label: "Weapon PA modifier",
      delta: weapon.paModifier,
      detail: "WM from codex",
    });
    if (shieldPA !== 0) {
      paBreakdown.push({
        label: "Companion shield PA",
        delta: shieldPA,
        detail: "Shield WM from other hand / armor shield row",
      });
    }
    if (parryResult.bonus !== 0) {
      const saLabel =
        parryResult.saLevel === "parrying_weapons_ii"
          ? "Parrying Weapons II"
          : "Parrying Weapons I";
      const pvFormula =
        parryResult.saLevel === "parrying_weapons_ii"
          ? `+2 + PV ${parryResult.parryingWeaponPv}`
          : `−1 + PV ${parryResult.parryingWeaponPv}`;
      paBreakdown.push({
        label: `${saLabel} (${parryResult.parryingWeaponName})`,
        delta: parryResult.bonus,
        detail: `${pvFormula} = ${parryResult.bonus >= 0 ? "+" : ""}${parryResult.bonus} PA (BRW p.102)`,
      });
    } else if (parryResult.saLevel !== "none") {
      paBreakdown.push({
        label: `Parrying Weapons I (${parryResult.parryingWeaponName})`,
        delta: 0,
        detail: `−1 + PV ${parryResult.parryingWeaponPv} = 0 net PA`,
      });
    }
    paBreakdown.push({
      label: "Encumbrance (⌈eff. EC/2⌉ from PA)",
      delta: -encPA,
      detail:
        encDetail +
        (armorUseSummary ? `; ${armorUseSummary}` : ""),
    });
  }

  if (parryResult.bonus !== 0 || parryResult.saLevel !== "none") {
    const saName =
      parryResult.saLevel === "parrying_weapons_ii" ? "Parrying Weapons II" : "Parrying Weapons I";
    notes.push(
      `${saName}: PA of this weapon is adjusted by ${parryResult.bonus >= 0 ? "+" : ""}${parryResult.bonus} (−1 + PV ${parryResult.parryingWeaponPv} of ${parryResult.parryingWeaponName}).`,
    );
  }

  const finalAT = baseAT + weapon.atModifier + shieldAT - encAT;
  const finalPA =
    basePA === null ? null : basePA + weapon.paModifier + shieldPA + parryResult.bonus - encPA;

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
    totalEC: rawTotalEC,
    effectiveTotalEC,
    ebe,
    combatTalentEec: eec,
    baseAT,
    basePA,
    weaponAT: weapon.atModifier,
    weaponPA: weapon.paModifier,
    shieldAT,
    shieldPA,
    parryingWeaponPA: parryResult.bonus,
    encumbranceAT: encAT,
    encumbrancePA: encPA,
    finalAT,
    finalPA,
    ini,
    ...dmgFields,
    notes,
    atBreakdown,
    paBreakdown,
    iniBreakdown,
    armorUseSummary,
  };
}

export function computeAllLoadoutWeaponLines(
  sheet: CharacterSheet,
  loadout: SheetLoadout,
): LoadoutWeaponCombatLine[] {
  const armors = loadout.armors;
  const allWeapons = loadout.weapons ?? [];
  const encTotals = computeLoadoutEncumbranceTotals(
    armors,
    sheet.specialAbilities,
  );
  const weaponBiasContext = loadoutWeaponsToBiasRows(allWeapons);
  return allWeapons.map((w) =>
    computeLoadoutWeaponLine(
      sheet,
      w,
      armors,
      weaponBiasContext,
      sumCompanionShieldModifiers(armors, allWeapons, w.id),
      encTotals,
      allWeapons,
    ),
  );
}
