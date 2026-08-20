import type { AttrCode, CharacterSheet, CombatAllocationRow } from "./types";

const GP_START = 110;
const MAX_DISADV_GP = 50;
const MAX_BAD_TRAIT_GP = 30;
const MAX_ATTR_SUM = 100;
const MIN_ATTR = 8;
const MAX_ATTR = 14;

export function validateGpBalance(sheet: CharacterSheet): string[] {
  const errs: string[] = [];
  if (sheet.budgets.gpEnd < 0)
    errs.push(`GP balance is negative (got ${sheet.budgets.gpEnd})`);
  return errs;
}

export function validateAttributePurchased(
  attrs: Record<AttrCode, number>
): string[] {
  const errs: string[] = [];
  let sum = 0;
  for (const k of Object.keys(attrs) as AttrCode[]) {
    const v = attrs[k];
    if (v < MIN_ATTR || v > MAX_ATTR)
      errs.push(`Attribute ${k} out of range ${MIN_ATTR}-${MAX_ATTR}: ${v}`);
    sum += v;
  }
  if (sum > MAX_ATTR_SUM)
    errs.push(`Sum of purchased attributes ${sum} exceeds ${MAX_ATTR_SUM}`);
  return errs;
}

export function validateAtPaSplit(rows: CombatAllocationRow[]): string[] {
  const errs: string[] = [];
  for (const r of rows) {
    if (r.combatType !== "melee") continue;
    const d = Math.abs(r.allocatedAT - r.allocatedPA);
    if (d > 5)
      errs.push(
        `AT/PA split for ${r.talentId}: |${r.allocatedAT}-${r.allocatedPA}|=${d} > 5`
      );
    if (r.allocatedAT + r.allocatedPA !== r.tp)
      errs.push(
        `AT+PA must equal TP for ${r.talentId}: ${r.allocatedAT}+${r.allocatedPA}≠${r.tp}`
      );
  }
  return errs;
}

export function validateTalentCap(
  tp: number,
  testAttrs: string[],
  finalAttrs: Record<AttrCode, number>
): string[] {
  const codes = testAttrs.filter((a): a is AttrCode =>
    ["CO", "CL", "IN", "CH", "DE", "AG", "CN", "ST"].includes(a)
  );
  const hi = Math.max(...codes.map((c) => finalAttrs[c] ?? 0), 0);
  const maxTp = hi + 3;
  if (tp > maxTp)
    return [`TP ${tp} exceeds max ${maxTp} for attrs ${codes.join("/")}`];
  return [];
}

export function validateTgpBudget(sheet: CharacterSheet): string[] {
  if (sheet.budgets.tgpSpent > sheet.budgets.tgpTotal + 0.5)
    return [
      `TGP overspent: ${sheet.budgets.tgpSpent} > ${sheet.budgets.tgpTotal}`,
    ];
  return [];
}

export function validateSgpBudget(sheet: CharacterSheet): string[] {
  if (sheet.budgets.sgpSpent > sheet.budgets.sgpTotal + 0.5)
    return [
      `SGP overspent: ${sheet.budgets.sgpSpent} > ${sheet.budgets.sgpTotal}`,
    ];
  return [];
}

export { GP_START, MAX_DISADV_GP, MAX_BAD_TRAIT_GP, MAX_ATTR_SUM, MIN_ATTR, MAX_ATTR };
