/**
 * Encumbrance (EC): codex armor field `ec`; talent **EEC** → **effective EC**; Armor Use (RG) I–III.
 * See `TDE4_character_creation_from_scratch.txt` and English Basic Rules (TDE_basicrules.pdf).
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
 * Applies combat talent **EEC** to worn aggregate EC (`effectiveTotalEC` after Armor Use) → **effective EC** (numeric penalty).
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

/** Tie-break: higher EC, then armor id. */
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

/** Armor category slug for Armor Use I from SA note + loadout (e.g. chain_scale). */
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

  const token = note.replace(/\s+/g, "_");
  if (token) {
    const byId = arm.find((a) => a.id.includes(token) || token.includes(a.id));
    if (byId?.category) return byId.category;
  }

  const hi = pickHighestEcArmor(arm);
  return hi?.category ?? null;
}

function rgOneCategoryRepresentedOnLoadout(
  list: SheetLoadoutArmor[],
  categoryOne: string | null,
): boolean {
  return (
    !!categoryOne &&
    list.some((a) => (a.category ?? "") === categoryOne)
  );
}

export type ArmorUseReductionSummary = {
  hasOne: boolean;
  hasTwo: boolean;
  hasThree: boolean;
  categoryOne: string | null;
  /** Armor Use / aggregate EC reduction — surfaced in sheet + combat tooltips. */
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

  const list = armors ?? [];
  const rgOneApplicable =
    hasOne &&
    rgOneCategoryRepresentedOnLoadout(list, categoryOne ?? null);

  const parts: string[] = [];
  if (hasThree) {
    parts.push(
      "Armor Use III: −2 total worn EC (Sword Paths / WdS supplement).",
    );
  } else if (hasTwo) {
    parts.push(
      "Armor Use II: −1 total worn EC; does not stack with Armor Use I (Basic Rules).",
    );
  } else if (hasOne && rgOneApplicable) {
    parts.push(
      categoryOne
        ? `Armor Use I: −1 total worn EC for armor type “${categoryOne.replace(/_/g, " ")}”.`
        : "Armor Use I: −1 total worn EC for qualifying worn armor.",
    );
  }

  const summary = parts.length ? parts.join("; ") : "";

  return { hasOne, hasTwo, hasThree, categoryOne, summary };
}

/**
 * Armor Use reduces **aggregate worn EC once** (Basic Rules + optional WdS tier III).
 * `pieces`: raw per-piece EC for display; `effectiveTotalEC`: EC after Armor Use.
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

  const ids = new Set(specialAbilities.map((x) => x.id));
  const hasThree = ids.has(ARMOR_USE_III);
  const hasTwo = ids.has(ARMOR_USE_II);
  const hasOne = ids.has(ARMOR_USE_I);
  const categoryOne = resolveArmorUseOneCategory(list, specialAbilities);

  const rgOneApplicable =
    hasOne &&
    !hasTwo &&
    !hasThree &&
    rgOneCategoryRepresentedOnLoadout(list, categoryOne);

  let reduction = 0;
  if (hasThree) reduction = 2;
  else if (hasTwo) reduction = 1;
  else if (rgOneApplicable) reduction = 1;

  const effectiveTotalEC = Math.max(0, rawTotalEC - reduction);
  const pieces = list.map((a) => pieceEc(a));
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
 * Talent row: usable **TP** after subtracting full **effective EC** from codex **EEC** (not the melee AT/PA half split).
 * Missing codex `eec`: no EC penalty here (not implicitly “full EC”).
 */
export function talentTpAfterEecEncumbrance(
  tp: number,
  eecRaw: string | undefined,
  effectiveTotalEC: number,
): { ebe: number; effectiveTp: number } {
  if (eecRaw == null || String(eecRaw).trim() === "") {
    return { ebe: 0, effectiveTp: tp };
  }
  const ebe = parseEffectiveEncumbrance(eecRaw, effectiveTotalEC);
  return { ebe, effectiveTp: tp - ebe };
}
