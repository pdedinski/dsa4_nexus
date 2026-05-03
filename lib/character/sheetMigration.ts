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

/** Sheets saved before Leittalent object modifiers were parsed could store TP as strings like "0[object Object]". */
function coerceFiniteTp(tp: unknown): number {
  if (typeof tp === "number" && Number.isFinite(tp)) return tp;
  if (typeof tp === "string") {
    if (tp.includes("[object")) {
      const m = /^(-?\d+)/.exec(tp);
      if (m) return Number(m[0]);
    }
    const n = Number(tp);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function normalizeMangledTpOnSheet(sheet: CharacterSheet): CharacterSheet {
  let changed = false;
  const talents = sheet.talents.map((t) => {
    const tp = coerceFiniteTp(t.tp);
    if (tp !== t.tp) changed = true;
    return { ...t, tp };
  });
  const combatMelee = sheet.combatMelee.map((r) => {
    const tp = coerceFiniteTp(r.tp);
    const allocatedAT = coerceFiniteTp(r.allocatedAT);
    const allocatedPA = coerceFiniteTp(r.allocatedPA);
    const finalAT = coerceFiniteTp(r.finalAT);
    const finalPA = coerceFiniteTp(r.finalPA);
    if (
      tp !== r.tp ||
      allocatedAT !== r.allocatedAT ||
      allocatedPA !== r.allocatedPA ||
      finalAT !== r.finalAT ||
      finalPA !== r.finalPA
    )
      changed = true;
    return { ...r, tp, allocatedAT, allocatedPA, finalAT, finalPA };
  });
  const combatRanged = sheet.combatRanged.map((r) => {
    const tp = coerceFiniteTp(r.tp);
    const finalAT = coerceFiniteTp(r.finalAT);
    if (tp !== r.tp || finalAT !== r.finalAT) changed = true;
    return { ...r, tp, finalAT };
  });
  return changed ? { ...sheet, talents, combatMelee, combatRanged } : sheet;
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

  if (next.loadout) {
    const raw = next.loadout as Record<string, unknown>;
    if (raw.weapon != null || raw.armor != null) {
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
      next = {
        ...next,
        loadout: Object.keys(loadout).length ? loadout : undefined,
      };
    }
  }

  return normalizeMangledTpOnSheet(next);
}
