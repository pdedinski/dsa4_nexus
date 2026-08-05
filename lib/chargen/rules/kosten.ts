/**
 * Advancement cost table (SKT) + talent/spell/attribute AP helpers.
 * Ported from Java Chargen `basis/SKT.java` and related Kosten strategies.
 */

import sktData from "@/lib/chargen/data/skt.json";
import type { AttrCode, HeldModel } from "@/lib/chargen/types";
import { attrValue } from "@/lib/chargen/types";

const COL_INDEX: Record<string, number> = {
  "A*": 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
};

export function columnIndex(col: string): number {
  const key = col.replace(/[()]/g, "").trim();
  return COL_INDEX[key] ?? COL_INDEX[key.toUpperCase()] ?? 2;
}

/** Cost to raise from (level-1) to `level` (1-based raise target), or activation at index 0. */
export function sktCost(column: string | number, levelOrActivationIndex: number): number {
  const col =
    typeof column === "number" ? column : columnIndex(column);
  const clampedCol = Math.max(0, Math.min(8, col));
  const idx = Math.max(0, Math.min(31, levelOrActivationIndex));
  return sktData.costs[clampedCol][idx] ?? 0;
}

export function sktActivationCost(column: string | number): number {
  return sktCost(column, 0);
}

const SKT_COLUMN_LETTERS = ["A*", "A", "B", "C", "D", "E", "F", "G", "H"];

/** Display label for an SKT column, e.g. `(D)`. */
export function sktColumnLabel(column: string | number): string {
  const idx =
    typeof column === "number"
      ? Math.max(0, Math.min(8, column))
      : columnIndex(column);
  return `(${SKT_COLUMN_LETTERS[idx]})`;
}

export function sktFactor(column: string | number): number {
  const col =
    typeof column === "number" ? column : columnIndex(column);
  return sktData.factors[Math.max(0, Math.min(8, col))] ?? 1;
}

/** AP to raise a talent/spell from `from` to `to` inclusive of each step. */
export function apToRaise(
  column: string | number,
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  let sum = 0;
  for (let lvl = from + 1; lvl <= to; lvl++) {
    // SKT array index = target level when raising (Java getKosten(stufe, spalte) with stufe = new level)
    sum += sktCost(column, Math.max(0, lvl));
  }
  return sum;
}

/** Default column for attributes during creation raises (column H). */
export const ATTR_COLUMN = "H";

export function attributeRaiseAp(from: number, to: number): number {
  return apToRaise(ATTR_COLUMN, from, to);
}

/** Default talent group → SKT column (simplified; Java uses per-talent Kosten). */
export function defaultTalentColumn(group: string): string {
  switch (group) {
    case "combat":
      return "D";
    case "physical":
      return "C";
    case "social":
      return "B";
    case "nature":
      return "B";
    case "knowledge":
      return "B";
    case "languages":
      return "A";
    case "scripts":
      return "A";
    case "craft":
      return "B";
    default:
      return "B";
  }
}

export function defaultSpellColumn(complexity: number): string {
  if (complexity <= 1) return "A";
  if (complexity === 2) return "B";
  if (complexity === 3) return "C";
  if (complexity === 4) return "D";
  if (complexity === 5) return "E";
  return "F";
}

/** Rough GP cost for a VorNachteil when no specific Kosten strategy is wired. */
export function defaultTraitGp(id: string): number {
  // Disadvantages typically grant GP (negative cost); advantages cost GP.
  // Without full Kosten strategies, treat unknown as 0 and let Problems warn.
  void id;
  return 0;
}

export function hasTrait(held: HeldModel, id: string): boolean {
  return held.advantagesDisadvantages.some((t) => t.id === id);
}

export function hasSpecialAbility(held: HeldModel, id: string): boolean {
  return held.specialAbilities.some((s) => s.id === id);
}

export function attributeSumBase(held: HeldModel): number {
  return held.attributes
    .filter((a) => a.code !== "SO")
    .reduce((sum, a) => sum + a.base, 0);
}

export function getClIn(held: HeldModel): { cl: number; inn: number } {
  return {
    cl: attrValue(held, "CL" as AttrCode),
    inn: attrValue(held, "IN" as AttrCode),
  };
}
