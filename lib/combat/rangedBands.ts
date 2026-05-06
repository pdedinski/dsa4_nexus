/**
 * BRW p.155 — ranged combat check modifiers per Reichweitenklasse.
 * Indices align with `meta.weapons.ranged_and_throwing.reichweiteklassen_order`
 * (sehr_nah → extrem_weit) and weapon `range_bands_schritt_upper`.
 */
export const WEAPON_RANGE_FK_BY_BAND = [-2, 0, 4, 8, 12] as const;

export const WEAPON_RANGE_BAND_LABELS = [
  "Very close",
  "Close",
  "Medium",
  "Far",
  "Very far",
] as const;

export function formatSignedMod(n: number): string {
  if (n === 0) return "±0";
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatTpPlusCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v === 0) return "0";
    return formatSignedMod(v);
  }
  return String(v);
}
