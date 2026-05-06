import type advancementCostsJson from "@/data/meta/advancement_costs.json";

type TalentColumns = (typeof advancementCostsJson)["talent_columns"]["columns"];

/** SKT row "Akt./0" (Basisregelwerk p. 198) — spell activation; same table for talents. */
const SKT_ACTIVATION_BY_COLUMN: Partial<Record<string, number>> = {
  A: 5,
  B: 10,
  C: 15,
  D: 20,
  E: 25,
  F: 40,
  G: 50,
  H: 100,
};

export function talentActivationCost(
  columns: TalentColumns,
  col: string
): number {
  const c = columns[col as keyof TalentColumns];
  return c?.activation_cost ?? 99;
}

/**
 * Sum of per-step costs from the talent advancement table (BRW / TDE column A–H;
 * `data/meta/advancement_costs.json`), for raising TP from `from` to `to`.
 * Each integer step v → v+1 uses the entry `"{v}_to_{v+1}"` in `costs_by_value`
 * (including negative starting values, e.g. `-1_to_0`).
 * Character generation spends **TGP** using the same numeric values as AP per step
 * for that column (one row per +1 TP).
 */
export function talentStepsCost(
  columns: TalentColumns,
  col: string,
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  const c = columns[col as keyof TalentColumns];
  if (!c) return 9999;
  let sum = 0;
  for (let v = from; v < to; v++) {
    const key = `${v}_to_${v + 1}` as keyof typeof c.costs_by_value;
    const step = c.costs_by_value[key];
    sum += step ?? 99;
  }
  return sum;
}

/**
 * Spell activation uses SKT row Akt./0 (p. 198). Pass the **effective** column after
 * cross-tradition shifts (+2 columns, p. 204). Step costs use `talentStepsCost` with the
 * same column (talent_columns SKT matches spell ZfW steps).
 */
export function spellActivationCost(
  _talentCols: TalentColumns,
  col: string
): number {
  return SKT_ACTIVATION_BY_COLUMN[col] ?? 999;
}

/**
 * SP step costs use the same SKT step table as talents (one row per +1 SP).
 */
export function spellAdvancementStepCost(
  talentCols: TalentColumns,
  col: string,
  from: number,
  to: number
): number {
  return talentStepsCost(talentCols, col, from, to);
}
