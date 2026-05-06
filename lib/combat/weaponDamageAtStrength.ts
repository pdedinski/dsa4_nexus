/**
 * TP from ST (WdS / BRW TP/ST column, JSON field `tp_kk` e.g. "11/4"):
 * full steps of ST above the listed threshold add that many steps of bonus TP to the fixed part of the dice damage.
 */

import weaponsCodex from "@/data/equipment/weapons.json";

type WeaponCodexRow = { id: string; tp_kk?: string };

const ENDURANCE_SUFFIX = /\(([Aa])\)$/;

function splitDiceAndSuffix(raw: string): { core: string; suffix: string } {
  const t = raw.trim();
  const m = ENDURANCE_SUFFIX.exec(t);
  if (!m) return { core: t, suffix: "" };
  const core = t.slice(0, m.index).trimEnd();
  return { core, suffix: m[0] };
}

/** NdM with optional signed integer modifier; ignores trailing suffix like (A). */
const DICE_WITH_MOD = /^(\d+)d(\d+)(([+-])(\d+))?$/i;

function mergeFixedModifierIntoDiceCore(core: string, bonus: number): string | null {
  const c = core.trim();
  const m = DICE_WITH_MOD.exec(c);
  if (!m) return null;
  const nDice = Number(m[1]);
  const nSides = Number(m[2]);
  let mod = 0;
  if (m[3]) mod = (m[4] === "-" ? -1 : 1) * Number(m[5]);
  const newMod = mod + bonus;
  let modPart = "";
  if (newMod !== 0) modPart = newMod > 0 ? `+${newMod}` : `${newMod}`;
  return `${nDice}d${nSides}${modPart}`;
}

export function parseTpKkRule(
  tpKk: string | undefined | null,
): { threshold: number; step: number } | null {
  const s = tpKk?.trim();
  if (!s) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  if (!m) return null;
  const threshold = Number(m[1]);
  const step = Number(m[2]);
  if (!Number.isFinite(threshold) || !Number.isFinite(step) || step <= 0) return null;
  return { threshold, step };
}

export function strengthTpBonusFromRule(strength: number, tpKk: string | undefined | null): number {
  const p = parseTpKkRule(tpKk);
  if (!p) return 0;
  return Math.max(0, Math.floor((strength - p.threshold) / p.step));
}

export function applyTpBonusToDamageString(damage: string, bonusTp: number): string {
  if (bonusTp === 0) return damage.trim();
  const { core, suffix } = splitDiceAndSuffix(damage);
  const merged = mergeFixedModifierIntoDiceCore(core, bonusTp);
  if (merged == null) return `${core.trim()} + ${bonusTp} TP${suffix}`;
  return `${merged}${suffix}`;
}

export type ResolvedWeaponDamage = {
  display: string;
  bonusTp: number;
  ruleLabel: string | undefined;
};

/**
 * Computes listed damage plus optional TP from ST when `tp_kk` encodes TP/ST thresholds.
 * When no rule, `display` is the codex damage and `bonusTp` stays 0.
 */
export function resolveWeaponDamageAtStrength(
  strength: number,
  damage: string | undefined | null,
  tpKk: string | undefined | null,
): ResolvedWeaponDamage {
  const dmg = damage?.trim() ?? "";
  if (!dmg) return { display: "—", bonusTp: 0, ruleLabel: undefined };
  const parsedRule = parseTpKkRule(tpKk);
  const ruleLabel =
    parsedRule && tpKk != null ? tpKk.trim().replace(/\s+/g, "") : undefined;
  const bonusTp =
    parsedRule != null
      ? Math.max(0, Math.floor((strength - parsedRule.threshold) / parsedRule.step))
      : 0;
  return {
    display: applyTpBonusToDamageString(dmg, bonusTp),
    bonusTp,
    ruleLabel,
  };
}

/** Short note for the character sheet when TP/ST scaling is defined for the weapon. */
export function weaponDamageStrengthNote(resolved: ResolvedWeaponDamage, strength: number): string {
  const { bonusTp, ruleLabel } = resolved;
  if (!ruleLabel) return "";
  if (bonusTp > 0) {
    return `+${bonusTp} TP from ST ${strength} (TP/ST ${ruleLabel}).`;
  }
  return `TP/ST ${ruleLabel}: no extra TP at ST ${strength} (base damage).`;
}

/** Prefer stored sheet value; otherwise look up current codex (older sheets predate `tpKk` on loadout). */
export function tpKkForLoadoutWeapon(
  weaponId: string,
  sheetTpKk: string | undefined,
): string | undefined {
  const fromSheet = sheetTpKk?.trim();
  if (fromSheet) return fromSheet;
  const w = (weaponsCodex.weapons as WeaponCodexRow[]).find((x) => x.id === weaponId);
  const c = typeof w?.tp_kk === "string" ? w.tp_kk.trim() : "";
  return c || undefined;
}
