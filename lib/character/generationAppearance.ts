/**
 * Appearance / age from race JSON tables (English labels) plus Java Chargen age bases.
 */

import colorLabelsData from "@/lib/chargen/data/color_labels.json";

const colorLabels = colorLabelsData as Record<string, string>;

/** Java `Alter` bases (Chargen `rassen.json`) keyed by Nexus race id. */
const AGE_BY_RACE: Record<string, { base: number; dice: number }> = {
  elf: { base: 25, dice: 20 },
  forest_elf: { base: 25, dice: 20 },
  firn_elf: { base: 25, dice: 20 },
  half_elf: { base: 15, dice: 3 },
  middenrealmian: { base: 15, dice: 3 },
  tulamide: { base: 15, dice: 3 },
  thorwalian: { base: 15, dice: 3 },
  dwarf: { base: 35, dice: 6 },
  standard_dwarf: { base: 35, dice: 6 },
  brilliant_dwarf: { base: 35, dice: 6 },
  wild_dwarf: { base: 35, dice: 6 },
};

const ELF_HAIR_FALLBACK: Record<string, string> = {
  "1": "blue black",
  "2-3": "black",
  "4-5": "silver",
  "6-7": "white blond",
  "8-11": "light blond",
  "12-17": "middle blond",
  "18-20": "dark blond",
};

const ELF_EYE_FALLBACK: Record<string, string> = {
  "1-2": "black-brown",
  "3-4": "gray-blue",
  "5-8": "sapphire blue",
  "9-12": "emerald green",
  "13-16": "dark violet",
  "17-18": "amber",
  "19": "gold-flecked",
  "20": "amethyst",
};

type AppearanceTables = {
  height_formula?: string;
  weight_formula?: string;
  hair_colors?: Record<string, string>;
  eye_colors?: Record<string, string>;
  notes?: string;
};

function translateColor(raw: string): string {
  const t = raw.trim();
  return colorLabels[t] || t;
}

function rollDie(rng: () => number, sides: number): number {
  return 1 + Math.floor(rng() * sides);
}

function rollMappedTable(
  rng: () => number,
  table: Record<string, string> | undefined,
): string {
  if (!table || Object.keys(table).length === 0) return "";
  const roll = rollDie(rng, 20);
  for (const [k, v] of Object.entries(table)) {
    if (k.includes("-")) {
      const [a, b] = k.split("-").map(Number);
      if (roll >= a && roll <= b) return translateColor(v);
    } else if (Number(k) === roll) {
      return translateColor(v);
    }
  }
  return translateColor(Object.values(table)[0]!);
}

/**
 * Parse WdH-style formulas: `"1.68 + 2d20 cm"`, `"1.28 + 2d6 cm"`, `"1.58 + 1d20 + 4d6 cm"`.
 */
export function rollHeightCmFromFormula(
  rng: () => number,
  formula: string | undefined,
  fallbackCm: number,
): number {
  if (!formula) return fallbackCm;
  const m = formula.match(
    /(\d+)\.(\d{2})\s*(?:\+\s*(\d+)d(\d+))?(?:\s*\+\s*(\d+)d(\d+))?/i,
  );
  if (!m) return fallbackCm;
  let cm = Number(m[1]) * 100 + Number(m[2]);
  if (m[3] && m[4]) {
    const n = Number(m[3]);
    const sides = Number(m[4]);
    for (let i = 0; i < n; i++) cm += rollDie(rng, sides);
  }
  if (m[5] && m[6]) {
    const n = Number(m[5]);
    const sides = Number(m[6]);
    for (let i = 0; i < n; i++) cm += rollDie(rng, sides);
  }
  return cm;
}

export function weightKgFromFormula(
  heightCm: number,
  formula: string | undefined,
  fallbackOffset: number,
): number {
  const m = formula?.match(/height_cm\s*-\s*(\d+)/i);
  const offset = m ? Number(m[1]) : fallbackOffset;
  return Math.max(35, heightCm - offset);
}

export function rollRaceAppearance(
  rng: () => number,
  raceId: string,
  physical: AppearanceTables | undefined,
  fallbackHeight: { heightCm: number; weightOffsetKg: number },
): { heightCm: number; weightKg: number; hair: string; eyes: string } {
  const heightCm = rollHeightCmFromFormula(
    rng,
    physical?.height_formula,
    fallbackHeight.heightCm,
  );
  const weightKg = weightKgFromFormula(
    heightCm,
    physical?.weight_formula,
    fallbackHeight.weightOffsetKg,
  );
  const elfish = raceId === "elf" || raceId === "forest_elf" || raceId === "firn_elf";
  const hairTable = physical?.hair_colors ?? (elfish ? ELF_HAIR_FALLBACK : undefined);
  const eyeTable = physical?.eye_colors ?? (elfish ? ELF_EYE_FALLBACK : undefined);
  const hair = rollMappedTable(rng, hairTable) || "brown";
  const eyes = rollMappedTable(rng, eyeTable) || "brown";
  return { heightCm, weightKg, hair, eyes };
}

export function rollRaceAgeYears(
  rng: () => number,
  raceId: string,
  opts: { timeConsuming: boolean; educatedRating: number },
): number {
  const spec = AGE_BY_RACE[raceId] ?? { base: 16, dice: 20 };
  let age = spec.base + rollDie(rng, spec.dice);
  if (opts.educatedRating > 0) age += Math.floor(opts.educatedRating / 2);
  if (opts.timeConsuming) age += 3;
  return age;
}

/** Java `Held.getGeschwindigkeit`: AG bands, then stature / mobility traits. */
export function computeGroundSpeed(
  agility: number,
  traitIds: ReadonlySet<string>,
): number {
  let gs = agility <= 10 ? 7 : agility >= 16 ? 9 : 8;
  if (traitIds.has("dwarf_stature")) gs -= 2;
  if (traitIds.has("one_legged")) gs -= 3;
  if (traitIds.has("lame")) gs -= 1;
  if (traitIds.has("fleet")) gs += 1;
  return gs;
}
