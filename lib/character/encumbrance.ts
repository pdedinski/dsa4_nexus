/**
 * Encumbrance (BE/EC), EEC parsing, and Rüstungsgewöhnung (Armor Use I–III) for loadout + talent display.
 */

import type {
  SheetLoadoutArmor,
  SpecialAbilityInstance,
} from "@/lib/character/types";

export const ARMOR_USE_I = "armor_use_i";
export const ARMOR_USE_II = "armor_use_ii";
export const ARMOR_USE_III = "armor_use_iii";

/** Normalize codex EEC strings (e.g. EC*2 vs ECx2). */
function normalizeEecRaw(raw: string): string {
  return raw.trim().replace(/\s+/g, "").replace(/\*/gi, "X").toUpperCase();
}

/**
 * Effective encumbrance (eBE) used for combat/talent encumbrance interaction from total worn EC (BE).
 * After {@link computeEffectiveArmorEcPerPiece}, pass `effectiveTotalEC` here.
 */
export function parseEffectiveEncumbrance(
  eecRaw: string | undefined,
  totalEC: number,
): number {
  const raw = (eecRaw ?? "EC").trim();
  if (!raw || raw === "0") return 0;
  const u = normalizeEecRaw(raw);
  if (u === "EC") return Math.max(0, totalEC);
  const sub = /^EC-(\d+)$/i.exec(raw.replace(/\s+/g, ""));
  if (sub) return Math.max(0, totalEC - Number(sub[1]));
  if (/^ECX2$/i.test(u)) return Math.max(0, totalEC * 2);
  return Math.max(0, totalEC);
}

export function totalLoadoutECRaw(
  armors: SheetLoadoutArmor[] | undefined,
): number {
  if (!armors?.length) return 0;
  return armors.reduce(
    (s, a) => s + (typeof a.ec === "number" ? a.ec : 0),
    0,
  );
}

function pieceEc(a: SheetLoadoutArmor): number {
  return typeof a.ec === "number" ? a.ec : 0;
}

/** Deterministic tie-break: higher EC, then armor id. */
function pickHighestEcArmor(
  armors: SheetLoadoutArmor[],
): SheetLoadoutArmor | null {
  if (!armors.length) return null;
  let best = armors[0]!;
  let bestEc = pieceEc(best);
  for (let i = 1; i < armors.length; i++) {
    const a = armors[i]!;
    const ec = pieceEc(a);
    if (ec > bestEc || (ec === bestEc && a.id.localeCompare(best.id) < 0)) {
      best = a;
      bestEc = ec;
    }
  }
  return best;
}

/**
 * Map SA note + loadout to armor category slug (e.g. chain_scale) for Armor Use I.
 */
export function resolveArmorUseOneCategory(
  armors: SheetLoadoutArmor[] | undefined,
  specialAbilities: SpecialAbilityInstance[],
): string | null {
  const arm = armors ?? [];
  const iRow = specialAbilities.find((s) => s.id === ARMOR_USE_I);
  if (!iRow) return null;

  const note = (iRow.note ?? "").toLowerCase().trim();
  const noteToCategory = (): string | null => {
    if (!note) return null;
    if (
      note.includes("chain") ||
      note.includes("mail") ||
      note.includes("ketten")
    )
      return "chain_scale";
    if (note.includes("plate") || note.includes("platte"))
      return "plate";
    if (note.includes("leather") || note.includes("leder")) return "leather";
    if (
      note.includes("cloth") ||
      note.includes("padded") ||
      note.includes("gambeson") ||
      note.includes("wattier")
    )
      return "cloth";
    if (note.includes("shield") || note.includes("schild")) return "shield";
    if (note.includes("helmet") || note.includes("helm")) return "helmet";
    return null;
  };

  const fromNote = noteToCategory();
  if (fromNote) return fromNote;

  /** Try matching note tokens to armor ids (e.g. "long_chainmail"). */
  const token = note.replace(/\s+/g, "_");
  if (token) {
    const byId = arm.find((a) => a.id.includes(token) || token.includes(a.id));
    if (byId?.category) return byId.category;
  }

  const hi = pickHighestEcArmor(arm);
  return hi?.category ?? null;
}

export type ArmorUseReductionSummary = {
  hasOne: boolean;
  hasTwo: boolean;
  hasThree: boolean;
  categoryOne: string | null;
  /** Human-readable armor use line for UI/tooltips. */
  summary: string;
};

export function summarizeArmorUseReductions(
  armors: SheetLoadoutArmor[] | undefined,
  specialAbilities: SpecialAbilityInstance[],
): ArmorUseReductionSummary {
  const ids = new Set(specialAbilities.map((x) => x.id));
  const hasThree = ids.has(ARMOR_USE_III);
  const hasTwo = ids.has(ARMOR_USE_II);
  const hasOne = ids.has(ARMOR_USE_I);
  const categoryOne = resolveArmorUseOneCategory(armors, specialAbilities);

  const parts: string[] = [];
  if (hasThree) parts.push("Armor Use III: −2 EC per armor piece");
  else {
    if (hasTwo) parts.push("Armor Use II: −1 EC per armor piece");
    if (hasOne) {
      parts.push(
        categoryOne
          ? `Armor Use I: −1 EC for category “${categoryOne.replace(/_/g, " ")}”`
          : "Armor Use I: −1 EC (category from highest-EC worn piece)",
      );
    }
  }
  const summary = parts.length ? parts.join("; ") : "";

  return { hasOne, hasTwo, hasThree, categoryOne, summary };
}

/**
 * Per-piece EC after Rüstungsgewöhnung. III: −2 each (replaces lower-tier global steps). Else II: −1 each; I: extra −1 on matching category.
 */
export function computeEffectiveArmorEcPerPiece(
  armors: SheetLoadoutArmor[] | undefined,
  specialAbilities: SpecialAbilityInstance[],
): { pieces: number[]; effectiveTotalEC: number; rawTotalEC: number } {
  const list = armors ?? [];
  const rawTotalEC = totalLoadoutECRaw(list);
  if (!list.length) {
    return { pieces: [], effectiveTotalEC: 0, rawTotalEC: 0 };
  }

  const { hasOne, hasTwo, hasThree, categoryOne } =
    summarizeArmorUseReductions(list, specialAbilities);

  const pieces = list.map((a) => {
    let ec = pieceEc(a);
    const cat = a.category ?? "";

    if (hasThree) {
      ec = Math.max(0, ec - 2);
    } else {
      if (hasTwo) ec = Math.max(0, ec - 1);
      if (hasOne && categoryOne && cat === categoryOne) {
        ec = Math.max(0, ec - 1);
      }
    }
    return ec;
  });

  const effectiveTotalEC = pieces.reduce((s, n) => s + n, 0);
  return { pieces, effectiveTotalEC, rawTotalEC };
}

export type LoadoutEncumbranceTotals = {
  rawTotalEC: number;
  effectiveTotalEC: number;
  armorUse: ArmorUseReductionSummary;
};

export function computeLoadoutEncumbranceTotals(
  armors: SheetLoadoutArmor[] | undefined,
  specialAbilities: SpecialAbilityInstance[],
): LoadoutEncumbranceTotals {
  const { effectiveTotalEC, rawTotalEC } = computeEffectiveArmorEcPerPiece(
    armors,
    specialAbilities,
  );
  const armorUse = summarizeArmorUseReductions(armors, specialAbilities);
  return { rawTotalEC, effectiveTotalEC, armorUse };
}

/**
 * Talent test display: effective TP after encumbrance malus from eBE (full value, not melee split).
 * Matches using eBE as points that reduce usable TP on encumbered tests.
 */
export function talentTpAfterEecEncumbrance(
  tp: number,
  eecRaw: string | undefined,
  effectiveTotalEC: number,
): { ebe: number; effectiveTp: number } {
  const ebe = parseEffectiveEncumbrance(eecRaw, effectiveTotalEC);
  return { ebe, effectiveTp: tp - ebe };
}
