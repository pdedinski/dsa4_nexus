/**
 * Canonical character sheet shape for DSA 4.1 / TDE4 (stored in DB + generator output).
 * Aligned with TDE4_character_creation_from_scratch.txt sections CC-03 / CC-12.
 */

export type AttrCode = "CO" | "CL" | "IN" | "CH" | "DE" | "AG" | "CN" | "ST";

export const ATTR_CODES: AttrCode[] = [
  "CO",
  "CL",
  "IN",
  "CH",
  "DE",
  "AG",
  "CN",
  "ST",
];

export type ConceptId =
  | "combat_frontliner"
  | "combat_skirmisher"
  | "ranged"
  | "stealth"
  | "social"
  | "wilderness"
  | "scholar"
  | "healer"
  | "sailor"
  | "rogue_criminal"
  | "noble_knightly"
  | "magical_guild"
  | "magical_elven"
  | "magical_dabbler"
  | "entertainer"
  | "any";

/** Random SGP allocation: `none` excludes the spell from the weighted pool (default). */
export type SpellPriority = "none" | "high" | "medium" | "low";

export interface CharacterHeader {
  displayName: string;
  conceptId: ConceptId;
  raceId: string;
  raceName: string;
  cultureId: string;
  cultureName: string;
  professionId: string;
  professionName: string;
  gender: "male" | "female";
  ageYears: number;
}

export type AttributesBlock = Record<AttrCode, number> & { SO: number };

export interface DerivedBlock {
  VP: number;
  EP: number;
  WT: number;
  baseAT: number;
  basePA: number;
  /** Base Ranged Value (English); German rules: FK-Basiswert. */
  baseBRV: number;
  baseINI: number;
  RM: number;
  ASP: number;
  GS: number;
}

/** One branch of an automatic “pick one disadvantage” obligation (culture / race JSON). */
export interface TraitPickOneAlternative {
  id: string;
  rating?: number;
  note?: string;
}

export interface TraitInstance {
  id: string;
  name?: string;
  rating?: number;
  note?: string;
  /**
   * When set (e.g. Arrogance vs Vengefulness for Novadis), the hero takes exactly one
   * of these disadvantages at the given rating — not every id in `pick_one_disadvantages`.
   */
  pick_one_disadvantages?: TraitPickOneAlternative[];
}

export interface SpecialAbilityInstance {
  id: string;
  name?: string;
  note?: string;
}

export interface TalentValueRow {
  id: string;
  name: string;
  group: string;
  tp: number;
  testAttributes: string[];
  advancementColumn: string;
  isBasic?: boolean;
}

export interface SpellValueRow {
  id: string;
  name: string;
  sp: number;
  tradition: string;
  advancementColumn: string;
}

export interface CombatAllocationRow {
  talentId: string;
  talentName: string;
  tp: number;
  allocatedAT: number;
  allocatedPA: number;
  finalAT: number;
  finalPA: number;
  combatType: "melee" | "ranged" | "unknown";
}

export interface RangedCombatRow {
  talentId: string;
  talentName: string;
  tp: number;
  finalAT: number;
}

export interface BudgetSummary {
  gpStart: number;
  gpEnd: number;
  raceGp: number;
  cultureGp: number;
  professionGp: number;
  attributeSumPurchased: number;
  soExtraGp: number;
  extraApApplied: number;
  tgpTotal: number;
  tgpSpent: number;
  sgpTotal: number;
  sgpSpent: number;
  tgpConvertedToSgp: number;
}

/** One weapon row copied from codex (modifiers are reference-only). */
export interface SheetLoadoutWeapon {
  id: string;
  name: string;
  combatTalent: string | null;
  damage?: string;
  atModifier: number;
  paModifier: number;
  iniModifier: number;
}

/** One armor row copied from codex. */
export interface SheetLoadoutArmor {
  id: string;
  name: string;
  ar: number;
  ec: number;
  iniModifier: number;
  category?: string;
  /** Shield AT modifier (WM); shields only. */
  atModifier?: number;
  /** Shield PA modifier (WM); shields only. */
  paModifier?: number;
}

/** Wizard / sheet snapshot of weapons & armor from codex. */
export interface SheetLoadout {
  weapons?: SheetLoadoutWeapon[];
  armors?: SheetLoadoutArmor[];
}

export interface PhysicalAppearance {
  heightCm: number;
  weightKg: number;
  hair: string;
  eyes: string;
  notes?: string;
}

export interface CharacterSheet {
  schemaVersion: 1;
  header: CharacterHeader;
  attributesPurchased: Record<AttrCode, number>;
  attributesFinal: AttributesBlock;
  derived: DerivedBlock;
  automaticAdvantages: TraitInstance[];
  automaticDisadvantages: TraitInstance[];
  chosenAdvantages: TraitInstance[];
  chosenDisadvantages: TraitInstance[];
  specialAbilities: SpecialAbilityInstance[];
  talents: TalentValueRow[];
  spells: SpellValueRow[];
  combatMelee: CombatAllocationRow[];
  combatRanged: RangedCombatRow[];
  startingEquipment: string[];
  startingMoneySilbertaler: number;
  physical: PhysicalAppearance;
  budgets: BudgetSummary;
  /** Weapons/armor chosen in creation wizard (optional). */
  loadout?: SheetLoadout;
  /**
   * Concept melee AT/PA tie-break when chosen weapons have neutral WM (PA−AT) for a talent.
   * Generation also aggregates weapon WM across selected weapons per combat talent.
   */
  atPaBias?: "offensive" | "defensive" | "balanced";
  /** Generator diagnostics (optional) */
  notes?: string[];
}

export interface GenerateCharacterInput {
  conceptId: ConceptId | "random";
  raceId: string | "random";
  cultureId: string | "random";
  professionId: string | "random";
  extraAp: number;
  /** When race is half_elf, user may opt into elvish upbringing full caster (+8 GP in rules) */
  halfElfFullCaster?: boolean;
  gender?: "male" | "female" | "random";
  spellPriorities?: Record<string, SpellPriority>;
  /** Optional weapon `id`s from `data/equipment/weapons.json` (order preserved, deduped server-side). */
  weaponIds?: string[];
  /** Optional armor `id`s from `data/equipment/armor.json` */
  armorIds?: string[];
  /** @deprecated use `weaponIds` */
  primaryWeaponId?: string;
  /** @deprecated use `armorIds` */
  primaryArmorId?: string;
}
