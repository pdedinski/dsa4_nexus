/**
 * Melee combat talent TP split between AT and PA (BRW / generator parity).
 * ±2 TP bias from weapon WM: net (PA−AT) modifiers on selected weapons nudges split;
 * when WM is neutral for a talent, the concept `at_pa_bias` is used as tie-break.
 */

export type AtPaBias = "offensive" | "defensive" | "balanced";

export type WeaponBiasRow = {
  combatTalent: string | null;
  atModifier: number;
  paModifier: number;
};

export function normalizeConceptAtPaBias(raw: unknown): AtPaBias {
  if (raw === "offensive" || raw === "defensive") return raw;
  return "balanced";
}

/** Core split + optional ±2 TP toward AT or PA, then |AT−PA| ≤ 5 clamp (matches generator). */
export function allocateMeleeCombatTp(
  tp: number,
  bias: AtPaBias
): { allocatedAT: number; allocatedPA: number } {
  if (tp <= 0) return { allocatedAT: 0, allocatedPA: 0 };
  let at = Math.floor(tp / 2);
  let pa = tp - at;
  if (bias === "offensive") at = Math.min(tp, at + 2);
  if (bias === "defensive") pa = Math.min(tp, pa + 2);
  while (Math.abs(at - pa) > 5) {
    if (at > pa) {
      at--;
      pa++;
    } else {
      at++;
      pa--;
    }
  }
  return { allocatedAT: at, allocatedPA: pa };
}

/** Σ(PA−AT) for weapons using `talentId`; null if no such weapon in the list. */
export function weaponPaAtNetForTalent(
  talentId: string,
  weapons: readonly WeaponBiasRow[]
): number | null {
  let sumPa = 0;
  let sumAt = 0;
  let n = 0;
  for (const w of weapons) {
    if (w.combatTalent !== talentId) continue;
    sumPa += w.paModifier;
    sumAt += w.atModifier;
    n++;
  }
  if (n === 0) return null;
  return sumPa - sumAt;
}

/** Bias for generator: weapon WM aggregate, else concept-only. */
export function meleeBiasForTalentFromWeapons(
  talentId: string,
  weaponRows: readonly WeaponBiasRow[],
  conceptBias: AtPaBias
): AtPaBias {
  const net = weaponPaAtNetForTalent(talentId, weaponRows);
  if (net === null) return conceptBias;
  if (net > 0) return "offensive";
  if (net < 0) return "defensive";
  return conceptBias;
}
