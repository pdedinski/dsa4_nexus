/**
 * Veteran AP spending profile utilities (shared by API routes and generator callers).
 */

import rawDefaultProfile from "@/data/meta/default_ap_profile.json";
import type {
  ApSpendingBand,
  ApSpendingProfile,
} from "@/lib/character/types";

export const DEFAULT_AP_PROFILE_ID = "default";

export type ApiApProfileRow = {
  id: string;
  name: string;
  description: string | null;
  bands: ApSpendingBand[];
  /** True only for bundled default JSON profile */
  isBuiltin?: boolean;
  createdAt?: string;
};

function cloneProfile(p: ApSpendingProfile): ApSpendingProfile {
  return JSON.parse(JSON.stringify(p)) as ApSpendingProfile;
}

export function loadBundledDefaultApProfile(): ApSpendingProfile {
  const p = rawDefaultProfile as ApSpendingProfile;
  return cloneProfile(p);
}

/** Normalize and validate percentages; fixes minor issues. Mutates bands in-place. */
function normalizeBands(bands: ApSpendingBand[]): void {
  for (const b of bands) {
    const clamp = (n: number | undefined) =>
      n === undefined ? undefined : Math.min(100, Math.max(0, n));
    if (b.attributes !== undefined) b.attributes = clamp(b.attributes);
    if (b.special_abilities !== undefined)
      b.special_abilities = clamp(b.special_abilities);
    if (b.talents !== undefined) b.talents = clamp(b.talents);
    if (b.spells !== undefined) b.spells = clamp(b.spells);
  }
}

/**
 * Validates band structure. Returns an error message or null when OK.
 * Does not require full coverage or non-overlap across ordinals — gaps fall back to default spending.
 */
export function validateApSpendingBands(
  bands: ApSpendingBand[],
): string | null {
  if (!Array.isArray(bands) || bands.length === 0) {
    return "At least one band is required.";
  }
  for (const b of bands) {
    if (typeof b.from !== "number" || !Number.isFinite(b.from) || b.from < 1) {
      return `Band "from" must be a finite number ≥ 1 (${JSON.stringify(b)}).`;
    }
    if (
      b.to !== null &&
      (typeof b.to !== "number" || !Number.isFinite(b.to))
    ) {
      return `Band "to" must be a finite number or null (${JSON.stringify(b)}).`;
    }
    if (b.to !== null && b.from > b.to) {
      return `Band "from" must be ≤ "to" (${JSON.stringify(b)}).`;
    }
    const pct = [
      b.attributes,
      b.special_abilities,
      b.talents,
      b.spells,
    ].filter((x) => x !== undefined);
    for (const p of pct) {
      if (
        typeof p !== "number" ||
        !Number.isFinite(p) ||
        p < 0 ||
        p > 100
      )
        return "Percent fields must be numbers between 0 and 100.";
    }
  }
  const sorted = [...bands].sort((a, c) => a.from - c.from);
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    if (cur.to === null) {
      return "Only the last band may omit \"to\" (open-ended upper bound).";
    }
    const next = sorted[i + 1]!;
    if (next.from <= cur.to) return "Bands must not overlap.";
  }
  return null;
}

export function coerceApBandsFromPayload(
  raw: unknown,
): { bands?: ApSpendingBand[]; error?: string } {
  if (!Array.isArray(raw)) return { error: "bands must be an array." };
  const bands = raw as ApSpendingBand[];
  const err = validateApSpendingBands(bands);
  if (err) return { error: err };
  normalizeBands(bands);
  return { bands };
}

export function sortBandsByFrom(bands: ApSpendingBand[]): ApSpendingBand[] {
  return [...bands].sort((a, b) => a.from - b.from);
}

/** First matching band wins (bands should be validated as non-overlapping). */
export function resolveBandForOrdinal(
  ordinal1Based: number,
  bandsSorted: readonly ApSpendingBand[],
): ApSpendingBand | null {
  for (const b of bandsSorted) {
    if (ordinal1Based >= b.from && (b.to === null || ordinal1Based <= b.to)) {
      return b;
    }
  }
  return null;
}

/**
 * Veteran AP ordinal runs 1..budget. Groups consecutive ordinals assigned to the same band
 * (or to the fallback “gap” band with no explicit percentages).
 */
export function groupOrdinalSlices(
  budget: number,
  bandsSorted: readonly ApSpendingBand[],
): { fromOrdinal: number; toOrdinal: number; band: ApSpendingBand }[] {
  if (budget <= 0) return [];
  /** Empty percentages = 100% default talent/spell behaviour for uncovered ordinals. */
  const gapBand = { from: 1, to: null as number | null } satisfies ApSpendingBand;
  const out: {
    fromOrdinal: number;
    toOrdinal: number;
    band: ApSpendingBand;
  }[] = [];
  let o = 1;
  while (o <= budget) {
    const r = resolveBandForOrdinal(o, bandsSorted);
    const bandUsed = r ?? gapBand;
    let end = o;
    while (end + 1 <= budget) {
      const r2 = resolveBandForOrdinal(end + 1, bandsSorted);
      const b2 = r2 ?? gapBand;
      const same =
        (r === null && r2 === null) ||
        (r !== null && r2 !== null && r === r2);
      if (!same) break;
      end++;
    }
    out.push({ fromOrdinal: o, toOrdinal: end, band: bandUsed });
    o = end + 1;
  }
  return out;
}
