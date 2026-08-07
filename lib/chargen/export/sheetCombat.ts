/**
 * Combat-value helpers for the hero document sheet.
 * Mirrors Java NahkampfwaffeWert / FernkampfwaffeWert / HeldExportRtf formulas.
 */

import type {
  HeldModel,
  MeleeWeaponWert,
  RangedWeaponWert,
} from "@/lib/chargen/types";
import { attrValue, derivedValue } from "@/lib/chargen/types";
import {
  applyTpBonusToDamageString,
  strengthTpBonusFromRule,
} from "@/lib/combat/weaponDamageAtStrength";

/**
 * Java `Kampftechnik.setEBe` values from `Talent.initialisiereKampftechnik(_, skt, eBe)`.
 * Display as EC±n with sign flipped for weapons (Java: BE + (−eBe)).
 */
export const COMBAT_TALENT_EBE: Record<string, number> = {
  "Talent.Anderthalbhaender": 2,
  "Talent.Armbrust": 5,
  "Talent.Bogen": 3,
  "Talent.Dolche": 1,
  "Talent.Fechtwaffen": 1,
  "Talent.Hiebwaffen": 4,
  "Talent.Infanteriewaffen": 3,
  "Talent.Kettenwaffen": 3,
  "Talent.Lanzenreiten": 0,
  "Talent.Raufen": 0,
  "Talent.Ringen": 0,
  "Talent.Saebel": 2,
  "Talent.Schwerter": 2,
  "Talent.Speere": 3,
  "Talent.Staebe": 2,
  "Talent.Wurfbeile": 2,
  "Talent.Wurfmesser": 3,
  "Talent.Wurfspeere": 2,
  "Talent.ZweihandHiebwaffen": 3,
  "Talent.Zweihandschwerter": 2,
};

/** English DC letters (Lokalisierung_en: C/M/P). */
export function formatDcEnglish(w: MeleeWeaponWert): string {
  return `${w.dkH ? "C" : ""}${w.dkN ? "M" : ""}${w.dkS ? "P" : ""}`;
}

/** Java weapon cell: `EC` + (−eBe), e.g. EC-1. Unarmed uses +eBe as-is. */
export function formatTypeEec(
  talentId: string | undefined,
  opts: { unarmed?: boolean } = {}
): string {
  if (!talentId) return "";
  const ebe = COMBAT_TALENT_EBE[talentId];
  if (ebe == null) return "EC";
  const signed = opts.unarmed ? ebe : -ebe;
  const sign = signed >= 0 ? "+" : "";
  return `EC${sign}${signed}`;
}

/** Normalize German W-dice formulas to English d (e.g. 1W+4 → 1d6+4, W+5 → 1d6+5). */
export function formatHpDice(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  // Bare W / W+n → 1d6…
  s = s.replace(/^(\d*)\s*[Ww](?=\d|[+-]|$)/, (_, n) => {
    const count = n && n !== "" ? n : "1";
    return `${count}d`;
  });
  // If still just "d" or "d+n" without sides, assume d6
  s = s.replace(/^(\d*)d(?![0-9])/, (_, n) => `${n || "1"}d6`);
  // 1d+4 → 1d6+4
  s = s.replace(/(\d+)d([+-]\d+)/, "$1d6$2");
  return s;
}

export function formatHpSt(threshold?: number, step?: number): string {
  if (threshold == null && step == null) return "";
  return `${threshold ?? 0}/${step ?? 0}`;
}

export function totalArmorEc(held: HeldModel): number {
  return held.armors.reduce((sum, a) => sum + (a.be ?? 0), 0);
}

function talentAttack(held: HeldModel, talentId: string | undefined): number {
  if (!talentId) return 0;
  const row = held.talents.find((t) => t.id === talentId);
  if (!row) return 0;
  return row.attack ?? 0;
}

function talentParade(held: HeldModel, talentId: string | undefined): number {
  if (!talentId) return 0;
  const row = held.talents.find((t) => t.id === talentId);
  if (!row) return 0;
  const at = row.attack ?? 0;
  return Math.max(0, row.tp - at);
}

function talentTp(held: HeldModel, talentId: string | undefined): number {
  if (!talentId) return 0;
  return held.talents.find((t) => t.id === talentId)?.tp ?? 0;
}

function hasTalent(held: HeldModel, talentId: string | undefined): boolean {
  if (!talentId) return false;
  return held.talents.some((t) => t.id === talentId);
}

function hasWeaponSpecialization(
  held: HeldModel,
  talentId: string | undefined,
  weaponId: string
): boolean {
  if (!talentId) return false;
  return held.specialAbilities.some(
    (s) =>
      (s.id.includes("Waffenspezialisierung") ||
        s.id.includes("WeaponSpecialization")) &&
      (s.talent === talentId || s.variant === weaponId || s.variant === talentId)
  );
}

/** Melee AV — Java NahkampfwaffeWert.getAttacke (simplified specialization / main-talent). */
export function meleeAttackValue(
  held: HeldModel,
  w: MeleeWeaponWert,
  mainTalentIds: string[]
): number {
  const talentId = w.talent;
  let v = derivedValue(held, "baseAT") + (w.wmAt ?? 0);
  if (hasTalent(held, talentId)) {
    v += talentAttack(held, talentId);
  }
  const isMain =
    talentId != null &&
    (mainTalentIds.length === 0 || mainTalentIds.includes(talentId));
  if (!hasTalent(held, talentId) || !isMain) {
    v -= 2;
  }
  if (hasWeaponSpecialization(held, talentId, w.id)) v += 1;
  const ebe = talentId != null ? (COMBAT_TALENT_EBE[talentId] ?? 0) : 0;
  const enc = Math.floor((totalArmorEc(held) - ebe) / 2);
  if (enc > 0) v -= enc;
  return v;
}

/** Melee PV — Java NahkampfwaffeWert.getParade. */
export function meleeParryValue(
  held: HeldModel,
  w: MeleeWeaponWert,
  mainTalentIds: string[]
): number {
  const talentId = w.talent;
  let v = derivedValue(held, "basePA") + (w.wmPa ?? 0);
  if (hasTalent(held, talentId)) {
    v += talentParade(held, talentId);
  }
  const isMain =
    talentId != null &&
    (mainTalentIds.length === 0 || mainTalentIds.includes(talentId));
  if (!hasTalent(held, talentId) || !isMain) {
    v -= 3;
  }
  if (hasWeaponSpecialization(held, talentId, w.id)) v += 1;
  const ebe = talentId != null ? (COMBAT_TALENT_EBE[talentId] ?? 0) : 0;
  const enc = Math.floor((totalArmorEc(held) - ebe + 1) / 2);
  if (enc > 0) v -= enc;
  return v;
}

/** Adjusted HP dice after ST bonus — Java Tp.getTpFormel((KK − threshold) / step). */
export function meleeAdjustedHp(held: HeldModel, w: MeleeWeaponWert): string {
  const base = formatHpDice(w.tp);
  if (!base) return "";
  const threshold = w.damageThreshold ?? 0;
  const step = w.damageStep ?? 0;
  if (step <= 0) return base;
  const rule = `${threshold}/${step}`;
  const bonus = strengthTpBonusFromRule(attrValue(held, "ST"), rule);
  return formatHpDice(applyTpBonusToDamageString(base, bonus));
}

/** Ranged AV — Java FernkampfwaffeWert.getFernkampfwert. */
export function rangedAttackValue(
  held: HeldModel,
  w: RangedWeaponWert,
  mainTalentId?: string
): number {
  const talentId = w.talent;
  let v = derivedValue(held, "baseBRV");
  if (hasTalent(held, talentId)) {
    v += talentTp(held, talentId);
  }
  const isMain =
    talentId != null &&
    (mainTalentId == null || mainTalentId === talentId || mainTalentId === "");
  if (!hasTalent(held, talentId) || (mainTalentId && !isMain)) {
    v -= 5;
  }
  if (hasWeaponSpecialization(held, talentId, w.id)) v += 2;
  const ebe = talentId != null ? (COMBAT_TALENT_EBE[talentId] ?? 0) : 0;
  const enc = totalArmorEc(held) - ebe;
  if (enc > 0) v -= enc;
  return v;
}

export function unarmedAttack(held: HeldModel, talentId: string): number {
  return (
    derivedValue(held, "baseAT") + talentAttack(held, talentId)
  );
}

export function unarmedParry(held: HeldModel, talentId: string): number {
  return (
    derivedValue(held, "basePA") + talentParade(held, talentId)
  );
}

export function unarmedHp(held: HeldModel): string {
  const st = attrValue(held, "ST");
  const bonus = Math.floor((st - 10) / 3);
  return formatHpDice(applyTpBonusToDamageString("1d6", bonus));
}
