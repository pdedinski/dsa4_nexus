import type advancementCostsJson from "@/data/meta/advancement_costs.json";

type TalentColumns = (typeof advancementCostsJson)["talent_columns"]["columns"];
type SpellColumns = (typeof advancementCostsJson)["spell_columns"]["columns"];

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

export function spellActivationCost(
  spellCols: SpellColumns,
  col: string,
  isGuildMagician: boolean
): number {
  const c = spellCols[col as keyof SpellColumns];
  if (!c) return 99;
  if (isGuildMagician) return c.activation_cost_guild ?? 99;
  return c.activation_cost_elf ?? 99;
}

export function spellAdvancementStepCost(
  spellCols: SpellColumns,
  col: string,
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  const c = spellCols[col as keyof SpellColumns];
  if (!c) return 9999;
  let sum = 0;
  for (let v = from; v < to; v++) {
    const key = `${v}_to_${v + 1}` as keyof typeof c.costs_by_value;
    const step = c.costs_by_value[key];
    sum += step ?? 99;
  }
  return sum;
}
