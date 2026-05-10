import type {
  CharacterSheet,
  SheetLoadout,
  SheetLoadoutArmor,
  SheetLoadoutWeapon,
  SpecialAbilityInstance,
  TalentValueRow,
} from "./types";

function persistTalent(t: TalentValueRow): TalentValueRow {
  const row: TalentValueRow = {
    id: t.id,
    name: t.name,
    group: t.group,
    tp: t.tp,
    testAttributes: [...t.testAttributes],
    advancementColumn: t.advancementColumn,
  };
  if (t.isBasic === true) row.isBasic = true;
  return row;
}

function persistSpecialAbility(s: SpecialAbilityInstance): SpecialAbilityInstance {
  const row: SpecialAbilityInstance = { id: s.id };
  if (s.name !== undefined && s.name !== "") row.name = s.name;
  if (s.note !== undefined && s.note !== "") row.note = s.note;
  return row;
}

function persistLoadoutWeapon(w: SheetLoadoutWeapon): SheetLoadoutWeapon {
  const row: SheetLoadoutWeapon = {
    id: w.id,
    name: w.name,
    combatTalent: w.combatTalent,
    atModifier: w.atModifier,
    paModifier: w.paModifier,
    iniModifier: w.iniModifier,
  };
  if (w.isShield === true) row.isShield = true;
  if (w.damage !== undefined && w.damage !== "") row.damage = w.damage;
  if (w.tpKk !== undefined && w.tpKk !== "") row.tpKk = w.tpKk;
  return row;
}

function persistLoadoutArmor(a: SheetLoadoutArmor): SheetLoadoutArmor {
  const row: SheetLoadoutArmor = {
    id: a.id,
    name: a.name,
    ar: a.ar,
    ec: a.ec,
    iniModifier: a.iniModifier,
  };
  if (a.category !== undefined && a.category !== "") row.category = a.category;
  if (a.atModifier !== undefined) row.atModifier = a.atModifier;
  if (a.paModifier !== undefined) row.paModifier = a.paModifier;
  return row;
}

function persistLoadout(lo: SheetLoadout | undefined): SheetLoadout | undefined {
  if (!lo) return undefined;
  const out: SheetLoadout = {};
  if (lo.weapons?.length)
    out.weapons = lo.weapons.map(persistLoadoutWeapon);
  if (lo.armors?.length) out.armors = lo.armors.map(persistLoadoutArmor);
  return Object.keys(out).length ? out : undefined;
}

/**
 * Canonical sheet shape for DB writes. Rebuilds nested rows from whitelisted fields only so
 * view-only keys (e.g. EEC-adjusted TP, effective EC after armor use) cannot persist even if
 * pasted into JSON — derived combat values stay computed on load/view.
 */
export function sanitizeCharacterSheetForStorage(sheet: CharacterSheet): CharacterSheet {
  return {
    ...sheet,
    talents: sheet.talents.map(persistTalent),
    specialAbilities: sheet.specialAbilities.map(persistSpecialAbility),
    loadout: persistLoadout(sheet.loadout),
  };
}
