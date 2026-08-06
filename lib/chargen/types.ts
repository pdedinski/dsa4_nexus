/**
 * Held-equivalent model for the Tools Player Character Generator.
 * Mirrors Java Chargen `basis/Held.java` with English attribute/derived codes.
 * Catalog entity IDs stay in German form (Rasse.*, Talent.*, …) for legacy XML compatibility.
 */

export type AttrCode = "CO" | "CL" | "IN" | "CH" | "DE" | "AG" | "CN" | "ST";
export type AttrCodeWithSo = AttrCode | "SO";

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

export const ATTR_CODES_WITH_SO: AttrCodeWithSo[] = [...ATTR_CODES, "SO"];

/** German ↔ English attribute ID map (Java Chargen IDs). */
export const ATTR_FROM_GERMAN: Record<string, AttrCodeWithSo> = {
  "Eigenschaft.Mut": "CO",
  "Eigenschaft.Klugheit": "CL",
  "Eigenschaft.Intuition": "IN",
  "Eigenschaft.Charisma": "CH",
  "Eigenschaft.Fingerfertigkeit": "DE",
  "Eigenschaft.Gewandtheit": "AG",
  "Eigenschaft.Konstitution": "CN",
  "Eigenschaft.Koerperkraft": "ST",
  "Eigenschaft.Sozialstatus": "SO",
  MU: "CO",
  KL: "CL",
  FF: "DE",
  GE: "AG",
  KO: "CN",
  KK: "ST",
};

export const ATTR_TO_GERMAN: Record<AttrCodeWithSo, string> = {
  CO: "Eigenschaft.Mut",
  CL: "Eigenschaft.Klugheit",
  IN: "Eigenschaft.Intuition",
  CH: "Eigenschaft.Charisma",
  DE: "Eigenschaft.Fingerfertigkeit",
  AG: "Eigenschaft.Gewandtheit",
  CN: "Eigenschaft.Konstitution",
  ST: "Eigenschaft.Koerperkraft",
  SO: "Eigenschaft.Sozialstatus",
};

export const ATTR_LABELS: Record<AttrCodeWithSo, string> = {
  CO: "Courage",
  CL: "Cleverness",
  IN: "Intuition",
  CH: "Charisma",
  DE: "Dexterity",
  AG: "Agility",
  CN: "Constitution",
  ST: "Strength",
  SO: "Social Standing",
};

export type DerivedCode =
  | "VP"
  | "EP"
  | "RM"
  | "ASP"
  | "WT"
  | "baseAT"
  | "basePA"
  | "baseBRV"
  | "baseINI"
  | "GS";

export const DERIVED_FROM_GERMAN: Record<string, DerivedCode> = {
  "Basiswert.Lebensenergie": "VP",
  "Basiswert.Ausdauer": "EP",
  "Basiswert.Magieresistenz": "RM",
  "Basiswert.Astralenergie": "ASP",
  "Basiswert.Wundschwelle": "WT",
  "Basiswert.Attacke": "baseAT",
  "Basiswert.Parade": "basePA",
  "Basiswert.Fernkampf": "baseBRV",
  "Basiswert.Initiative": "baseINI",
};

export const DERIVED_TO_GERMAN: Record<DerivedCode, string> = {
  VP: "Basiswert.Lebensenergie",
  EP: "Basiswert.Ausdauer",
  RM: "Basiswert.Magieresistenz",
  ASP: "Basiswert.Astralenergie",
  WT: "Basiswert.Wundschwelle",
  baseAT: "Basiswert.Attacke",
  basePA: "Basiswert.Parade",
  baseBRV: "Basiswert.Fernkampf",
  baseINI: "Basiswert.Initiative",
  GS: "Geschwindigkeit",
};

export type Gender = "male" | "female";

/** Creation vs post-creation (Steigern) — mirrors Java `Held.wirdErschaffen`. */
export type HeldPhase = "creation" | "veteran";

/**
 * Method of Learning — mirrors Java `Lernmethode` (session UI only, not persisted).
 */
export type LearningMethod =
  | "none"
  | "mutual"
  | "teacher"
  | "self_study"
  | "special_experience";

/** Column shift per learning method — port of `Lernmethode.bestimmeSteigerungsfaktor`. */
export const LEARNING_METHOD_COLUMN_SHIFT: Record<LearningMethod, number> = {
  special_experience: -1,
  teacher: -1,
  mutual: 0,
  none: 0,
  self_study: 1,
};

export const LEARNING_METHOD_LABELS: Record<LearningMethod, string> = {
  none: "None",
  mutual: "Mutual Teaching and Learning",
  teacher: "Teacher",
  self_study: "Teaching Yourself",
  special_experience: "Special Experience",
};

export interface AttributeWert {
  code: AttrCodeWithSo;
  /** Creation base (basisstufe). */
  base: number;
  /** Purchased raises (zukauf). */
  purchased: number;
  /** Session-local vorgegeben floor for zukauf (not exported). */
  purchasedBaseline?: number;
  specialExperience?: boolean;
}

export interface DerivedWert {
  code: DerivedCode;
  modification: number;
  base: number;
  purchased: number;
  maxPurchased?: number;
  /** Session-local vorgegeben floor for zukauf (not exported). */
  purchasedBaseline?: number;
  specialExperience?: boolean;
}

export interface TalentWert {
  id: string;
  /** Unmodified TP (unmodifizierte Stufe). */
  tp: number;
  /** Session-local vorgegeben floor (not exported). */
  baselineTp?: number;
  /** Attack allocation for combat techniques. */
  attack?: number;
  specialExperience?: boolean;
  activated?: boolean;
}

export interface SpellWert {
  id: string;
  sp: number;
  /** Session-local vorgegeben floor (not exported). */
  baselineSp?: number;
  variant?: string;
  specialExperience?: boolean;
  activated?: boolean;
}

export interface TraitWert {
  id: string;
  rating?: number;
  variant?: string;
  /** From race/culture/profession (Java vorgegeben) — does not affect GP. */
  granted?: boolean;
  /**
   * Rating granted free by a package (Java vorgegebene Stufe).
   * GP is charged only for levels above this baseline.
   */
  grantedRating?: number;
}

export type SpecialAbilityPayment = "ap" | "gp";

export interface SpecialAbilityWert {
  id: string;
  talent?: string;
  variant?: string;
  /** Creation-time payment currency (Java Zahlungsart). Defaults to AP. */
  payment?: SpecialAbilityPayment;
}

export interface MeleeWeaponWert {
  id: string;
  name?: string;
  talent?: string;
  tp?: string;
  bf?: number;
  ini?: number;
  wmAt?: number;
  wmPa?: number;
  dkH?: boolean;
  dkN?: boolean;
  dkS?: boolean;
  damageThreshold?: number;
  damageStep?: number;
}

export interface RangedWeaponWert {
  id: string;
  name?: string;
  talent?: string;
  tp?: string;
  ranges?: number[];
  tpPlus?: number[];
}

export interface ArmorWert {
  id: string;
  name?: string;
  rs?: number;
  be?: number;
}

export interface ShieldWert {
  id: string;
  name?: string;
  type?: string;
  bf?: number;
  ini?: number;
  wmAt?: number;
  wmPa?: number;
}

export interface HeldModel {
  schemaVersion: 1;
  format: "dsa-nexus-chargen";
  /** Creation wizard vs post-creation Steigern (veteran AP spending). */
  phase?: HeldPhase;
  name: string;
  title: string;
  status: string;
  gender: Gender;
  age: number;
  birthday: string;
  heightCm: number;
  weightKg: number;
  hairColor: string;
  eyeColor: string;
  appearance: string;
  background: string;
  raceId: string;
  cultureId: string;
  professionId: string;
  motherTongue?: string;
  secondLanguage?: string;
  attributes: AttributeWert[];
  derived: DerivedWert[];
  talents: TalentWert[];
  leadTalents: string[];
  spells: SpellWert[];
  houseSpells: string[];
  leadSpells: string[];
  advantagesDisadvantages: TraitWert[];
  specialAbilities: SpecialAbilityWert[];
  discountedSpecialAbilities: string[];
  meleeWeapons: MeleeWeaponWert[];
  rangedWeapons: RangedWeaponWert[];
  armors: ArmorWert[];
  shields: ShieldWert[];
  apTotal: number;
  apSpent: number;
  /** Creation-time GP remaining snapshot (optional). */
  gpRemaining?: number;
  notes?: string[];
}

export const GP_START = 110;

export function emptyHeld(): HeldModel {
  return {
    schemaVersion: 1,
    format: "dsa-nexus-chargen",
    phase: "creation",
    name: "",
    title: "",
    status: "",
    gender: "male",
    age: 20,
    birthday: "",
    heightCm: 170,
    weightKg: 70,
    hairColor: "",
    eyeColor: "",
    appearance: "",
    background: "",
    raceId: "",
    cultureId: "",
    professionId: "",
    attributes: ATTR_CODES_WITH_SO.map((code) => ({
      code,
      // Java EigenschaftWert starts at 0; mins applied after foundation (Weiter).
      base: 0,
      purchased: 0,
    })),
    derived: (
      [
        "VP",
        "EP",
        "RM",
        "ASP",
        "WT",
        "baseAT",
        "basePA",
        "baseBRV",
        "baseINI",
        "GS",
      ] as DerivedCode[]
    ).map((code) => ({
      code,
      modification: 0,
      base: 0,
      purchased: 0,
    })),
    talents: [],
    leadTalents: [],
    spells: [],
    houseSpells: [],
    leadSpells: [],
    advantagesDisadvantages: [],
    specialAbilities: [],
    discountedSpecialAbilities: [],
    meleeWeapons: [],
    rangedWeapons: [],
    armors: [],
    shields: [],
    apTotal: 0,
    apSpent: 0,
  };
}

export function attrValue(held: HeldModel, code: AttrCodeWithSo): number {
  const w = held.attributes.find((a) => a.code === code);
  return w ? w.base + w.purchased : 0;
}

/** Race / culture / profession attribute modifiers (free, not GP-cost). */
export interface AttributeMods {
  race?: Record<string, number>;
  culture?: Record<string, number>;
  profession?: Record<string, number>;
}

export function attributeModsSum(
  mods: AttributeMods | undefined,
  code: string
): number {
  if (!mods) return 0;
  return (
    (mods.race?.[code] ?? 0) +
    (mods.culture?.[code] ?? 0) +
    (mods.profession?.[code] ?? 0)
  );
}

/** Current attribute value including race/culture/profession modifiers. */
export function currentAttrValue(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods?: AttributeMods
): number {
  return attrValue(held, code) + attributeModsSum(mods, code);
}

export function derivedValue(held: HeldModel, code: DerivedCode): number {
  const w = held.derived.find((d) => d.code === code);
  return w ? w.base + w.modification + w.purchased : 0;
}

export function talentTp(held: HeldModel, id: string): number {
  return held.talents.find((t) => t.id === id)?.tp ?? 0;
}

export function isVeteranPhase(held: HeldModel): boolean {
  return held.phase === "veteran";
}

export type CatalogSource = "builtin" | "custom";

export interface CatalogEntryBase {
  id: string;
  name: string;
  german_name?: string;
  source?: CatalogSource;
}

export type ChargenCatalogCategory =
  | "races"
  | "cultures"
  | "professions"
  | "melee_weapons"
  | "ranged_weapons"
  | "armor"
  | "shields"
  | "talents"
  | "spells"
  | "advantages_disadvantages"
  | "special_abilities";

export const CHARGEN_CATALOG_CATEGORIES: ChargenCatalogCategory[] = [
  "races",
  "cultures",
  "professions",
  "melee_weapons",
  "ranged_weapons",
  "armor",
  "shields",
  "talents",
  "spells",
  "advantages_disadvantages",
  "special_abilities",
];
