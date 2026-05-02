import type {
  CharacterSheet,
  DerivedBlock,
  SheetLoadout,
  SheetLoadoutArmor,
  SheetLoadoutWeapon,
} from "./types";

function dedupeLoadoutWeapons(rows: SheetLoadoutWeapon[]): SheetLoadoutWeapon[] {
  const seen = new Set<string>();
  const out: SheetLoadoutWeapon[] = [];
  for (const r of rows) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function dedupeLoadoutArmors(rows: SheetLoadoutArmor[]): SheetLoadoutArmor[] {
  const seen = new Set<string>();
  const out: SheetLoadoutArmor[] = [];
  for (const r of rows) {
    if (!r?.id || seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

/**
 * Older stored sheets used `derived.baseFK` (German FK-Basiswert).
 * Canonical field is `baseBRV` (Base Ranged Value).
 * Older `loadout.weapon` / `loadout.armor` singletons become `weapons[]` / `armors[]`.
 */
export function migrateCharacterSheet(sheet: CharacterSheet): CharacterSheet {
  let next = sheet;
  const d = sheet.derived as unknown as Record<string, unknown>;
  if (typeof d.baseBRV !== "number" && typeof d.baseFK === "number") {
    const { baseFK: _drop, ...rest } = d;
    const derived = { ...rest, baseBRV: d.baseFK } as unknown as DerivedBlock;
    next = { ...next, derived };
  }

  if (!next.loadout) return next;
  const raw = next.loadout as Record<string, unknown>;
  if (raw.weapon == null && raw.armor == null) return next;

  const weapons: SheetLoadoutWeapon[] = Array.isArray(raw.weapons)
    ? [...(raw.weapons as SheetLoadoutWeapon[])]
    : [];
  const armors: SheetLoadoutArmor[] = Array.isArray(raw.armors)
    ? [...(raw.armors as SheetLoadoutArmor[])]
    : [];
  if (raw.weapon && typeof raw.weapon === "object")
    weapons.push(raw.weapon as SheetLoadoutWeapon);
  if (raw.armor && typeof raw.armor === "object")
    armors.push(raw.armor as SheetLoadoutArmor);

  const loadout: SheetLoadout = {};
  const w = dedupeLoadoutWeapons(weapons);
  const a = dedupeLoadoutArmors(armors);
  if (w.length) loadout.weapons = w;
  if (a.length) loadout.armors = a;

  return { ...next, loadout: Object.keys(loadout).length ? loadout : undefined };
}
