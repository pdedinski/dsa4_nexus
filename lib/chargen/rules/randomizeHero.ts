/**
 * Randomize hero name / appearance from Java Chargen race tables + NameFactorys.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel } from "@/lib/chargen/types";
import nameFactoriesData from "@/lib/chargen/data/name_factories.json";
import namenlistenData from "@/lib/chargen/data/namenlisten.json";
import colorLabelsData from "@/lib/chargen/data/color_labels.json";

export interface NameFactoryEntry {
  id: string;
  name: string;
  formats_male: string[];
  formats_male_noble: string[];
  formats_female: string[];
  formats_female_noble: string[];
  name_lists: Array<{ list_id: string; placeholder: string }>;
}

export interface NamenlisteEntry {
  id: string;
  name: string;
  names: string[];
}

const nameFactories = nameFactoriesData as NameFactoryEntry[];
const namenlisten = namenlistenData as NamenlisteEntry[];
const colorLabels = colorLabelsData as Record<string, string>;

function d(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

function pick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

function translateColor(raw: string | undefined | null): string {
  if (!raw) return "";
  return colorLabels[raw] || raw;
}

function rollTable(
  entries: Array<{ from: number; to: number; result: string }> | undefined
): string {
  if (!entries?.length) return "";
  const roll = d(20);
  const hit = entries.find((e) => roll >= e.from && roll <= e.to);
  return translateColor(hit?.result || entries[0]?.result);
}

export function listNameFactories(): NameFactoryEntry[] {
  return [...nameFactories].sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveNameFactoryId(
  culture: CatalogItem | null | undefined,
  overrideId?: string
): string | undefined {
  if (overrideId) return overrideId;
  const fromCulture = culture?.name_factory
    ? String(culture.name_factory)
    : undefined;
  return fromCulture;
}

function namesForList(listId: string): string[] {
  return namenlisten.find((n) => n.id === listId)?.names || [];
}

/**
 * Generate a name using a NameFactory (culture default or explicit override).
 * Noble formats used when the hero has Adlige Abstammung.
 */
export function generateName(
  held: HeldModel,
  factoryId: string | undefined
): string {
  if (!factoryId) return held.name || "";
  const factory = nameFactories.find((f) => f.id === factoryId);
  if (!factory) return held.name || "";

  const noble = held.advantagesDisadvantages.some(
    (t) => t.id === "VorNachteil.AdligeAbstammung"
  );
  const male = held.gender !== "female";
  let formats: string[];
  if (male) {
    formats =
      noble && factory.formats_male_noble.length
        ? factory.formats_male_noble
        : factory.formats_male;
  } else {
    formats =
      noble && factory.formats_female_noble.length
        ? factory.formats_female_noble
        : factory.formats_female;
  }
  let pattern = pick(formats) || "";
  if (!pattern) return "";

  // Replace each placeholder occurrence with a fresh random name from its list
  for (const { list_id, placeholder } of factory.name_lists) {
    if (!placeholder) continue;
    const names = namesForList(list_id);
    if (!names.length) continue;
    while (pattern.includes(placeholder)) {
      const name = pick(names) || "";
      pattern = pattern.replace(placeholder, name);
    }
  }
  return pattern.trim();
}

export function rollAge(
  held: HeldModel,
  race: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): number {
  const age = race?.age as { base?: number; dice?: number } | null | undefined;
  if (!age) return held.age;
  let result = Number(age.base ?? 0) + d(Number(age.dice ?? 6) || 6);
  const gebildet = held.advantagesDisadvantages.find(
    (t) => t.id === "VorNachteil.Gebildet"
  );
  if (gebildet?.rating) result += Math.floor(gebildet.rating / 2);
  if (
    profession &&
    (profession.time_consuming === true ||
      held.advantagesDisadvantages.some(
        (t) => t.id === "VorNachteil.AkademischeAusbildungGelehrter"
      ))
  ) {
    result += 3;
  }
  return result;
}

export function rollHeight(race: CatalogItem | null | undefined): number {
  const h = race?.height as
    | { base?: number; w6?: number; w20?: number }
    | null
    | undefined;
  if (!h) return 170;
  let result = Number(h.base ?? 0);
  for (let i = 0; i < Number(h.w20 ?? 0); i++) result += d(20);
  for (let i = 0; i < Number(h.w6 ?? 0); i++) result += d(6);
  return result;
}

export function rollWeight(
  held: HeldModel,
  race: CatalogItem | null | undefined,
  heightCm?: number
): number {
  const height = heightCm ?? held.heightCm;
  const factor =
    race?.weight_factor != null ? Number(race.weight_factor) : 100;
  let weight = height - factor;
  if (
    held.advantagesDisadvantages.some(
      (t) => t.id === "VorNachteil.Fettleibig"
    )
  ) {
    weight = Math.round(weight * (1.5 + Math.random()));
  }
  return Math.max(1, weight);
}

export function rollHairColor(race: CatalogItem | null | undefined): string {
  return rollTable(
    race?.hair_colors as
      | Array<{ from: number; to: number; result: string }>
      | undefined
  );
}

export function rollEyeColor(race: CatalogItem | null | undefined): string {
  return rollTable(
    race?.eye_colors as
      | Array<{ from: number; to: number; result: string }>
      | undefined
  );
}

/** Roll all appearance fields (not name). Height change recalculates weight. */
export function rollAllAppearance(
  held: HeldModel,
  race: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): Partial<HeldModel> {
  const heightCm = rollHeight(race);
  return {
    age: rollAge(held, race, profession),
    heightCm,
    weightKg: rollWeight(held, race, heightCm),
    hairColor: rollHairColor(race),
    eyeColor: rollEyeColor(race),
  };
}
