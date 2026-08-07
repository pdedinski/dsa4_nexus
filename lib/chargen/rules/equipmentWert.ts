/**
 * Seed equipment *Wert instances from catalog — mirrors Java setWaffe / setRuestung / setSchild.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type {
  ArmorWert,
  MeleeWeaponWert,
  RangedWeaponWert,
  ShieldWert,
} from "@/lib/chargen/types";

export const MAX_MELEE_WEAPONS = 5;
export const MAX_RANGED_WEAPONS = 3;
export const MAX_ARMORS = 5;
export const MAX_SHIELDS = 3;

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

function catalogTalentIds(item: CatalogItem): string[] {
  const talents = item.talents;
  if (Array.isArray(talents) && talents.length) {
    return talents.map(String);
  }
  if (item.talent) return [String(item.talent)];
  return [];
}

export function meleeWertFromCatalog(item: CatalogItem): MeleeWeaponWert {
  const talents = catalogTalentIds(item);
  return {
    id: String(item.id),
    name: (item.name as string) || String(item.id),
    talent: talents[0],
    tp: item.tp != null ? String(item.tp) : undefined,
    bf: num(item.bf),
    ini: num(item.ini),
    wmAt: num(item.wm_at),
    wmPa: num(item.wm_pa),
    dkH: bool(item.dk_h),
    dkN: bool(item.dk_n),
    dkS: bool(item.dk_s),
    damageThreshold: num(item.damage_threshold),
    damageStep: num(item.damage_step),
  };
}

export function rangedWertFromCatalog(item: CatalogItem): RangedWeaponWert {
  const talents = catalogTalentIds(item);
  const ranges = Array.isArray(item.ranges)
    ? (item.ranges as unknown[]).map((n) => num(n))
    : undefined;
  const tpPlus = Array.isArray(item.tp_plus)
    ? (item.tp_plus as unknown[]).map((n) => num(n))
    : undefined;
  return {
    id: String(item.id),
    name: (item.name as string) || String(item.id),
    talent: talents[0] || (item.talent ? String(item.talent) : undefined),
    tp: item.tp != null ? String(item.tp) : undefined,
    ranges,
    tpPlus,
  };
}

export function armorWertFromCatalog(item: CatalogItem): ArmorWert {
  return {
    id: String(item.id),
    name: (item.name as string) || String(item.id),
    rs: num(item.rs),
    be: num(item.be),
  };
}

export function shieldWertFromCatalog(item: CatalogItem): ShieldWert {
  return {
    id: String(item.id),
    name: (item.name as string) || String(item.id),
    type: item.type != null ? String(item.type) : undefined,
    bf: num(item.bf),
    ini: num(item.ini),
    wmAt: num(item.wm_at),
    wmPa: num(item.wm_pa),
  };
}

/** Java `SchildTyp` — EN labels from Lokalisierung_en.properties. */
export const SHIELD_TYPES: { id: string; label: string }[] = [
  { id: "SchildTyp.klein", label: "small" },
  { id: "SchildTyp.gross", label: "large" },
  { id: "SchildTyp.sehrGross", label: "extra large" },
];

export function shieldTypeLabel(typeId: string | undefined): string {
  if (!typeId) return "";
  return SHIELD_TYPES.find((t) => t.id === typeId)?.label ?? typeId;
}

export function weaponTalentOptions(item: CatalogItem | undefined): string[] {
  if (!item) return [];
  return catalogTalentIds(item);
}

/** Format DK flags as H/N/S string for the DC field. */
export function formatDk(w: MeleeWeaponWert): string {
  return `${w.dkH ? "H" : ""}${w.dkN ? "N" : ""}${w.dkS ? "S" : ""}`;
}

export function parseDk(raw: string): Pick<MeleeWeaponWert, "dkH" | "dkN" | "dkS"> {
  const u = raw.toUpperCase();
  return {
    dkH: u.includes("H"),
    dkN: u.includes("N"),
    dkS: u.includes("S"),
  };
}

export function formatHpSt(w: MeleeWeaponWert): string {
  return `${w.damageThreshold ?? 0}/${w.damageStep ?? 0}`;
}

export function parseHpSt(
  raw: string
): Pick<MeleeWeaponWert, "damageThreshold" | "damageStep"> | null {
  const m = raw.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return null;
  return {
    damageThreshold: Number(m[1]),
    damageStep: Number(m[2]),
  };
}

export function formatWm(w: { wmAt?: number; wmPa?: number }): string {
  return `${w.wmAt ?? 0}/${w.wmPa ?? 0}`;
}

export function parseWm(
  raw: string
): { wmAt: number; wmPa: number } | null {
  const m = raw.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return null;
  return { wmAt: Number(m[1]), wmPa: Number(m[2]) };
}

export function formatIntList(vals: number[] | undefined): string {
  return (vals ?? []).join(",");
}

export function parseIntList(raw: string): number[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}
