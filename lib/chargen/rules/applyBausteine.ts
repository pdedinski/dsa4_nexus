/**
 * Apply race/culture/profession fixed bonuses — mirrors
 * ErschaffungManager.anwendenTalentBoniRasseKultur / Profession.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import talenteCatalog from "@/lib/chargen/data/talente.json";
import type {
  HeldModel,
  SpellWert,
  TalentWert,
  TraitWert,
} from "@/lib/chargen/types";
import { currentAttrValue, type AttributeMods } from "@/lib/chargen/types";
import { estimateTraitGp, traitGpDelta, type TraitCatalogFields } from "@/lib/chargen/rules/traitLabels";
import {
  expandOpenTalentIds,
  isExpandableOpenTalentBonus,
} from "@/lib/chargen/rules/talentListMarkers";

const ELFISCHE_WELTSICHT = "VorNachteil.ElfischeWeltsicht";

/**
 * Java `Held` constructor: `Talent.getBasisTalente()` → `einfuegenVorgegeben(…, 0)`.
 * Basic talents are always vorgegeben at TP 0 (free; do not count as activations).
 */
const BASIC_TALENT_IDS: string[] = (
  talenteCatalog as Array<{ id: string; is_basic?: boolean }>
)
  .filter((t) => t.is_basic === true)
  .map((t) => t.id);

export interface TalentBonusEntry {
  /** `ancient_language` = Java `TalentbonusFestAlteSprache` (Bosparano/Proto-Tulamidyan). */
  type: "fixed" | "free" | "ancient_language";
  bonus?: number;
  bonuses?: number[];
  points?: number;
  talents?: string[];
  open?: boolean;
  /** Fest Leittalent="true" — Java TalentbonusFest.istLeittalent() */
  lead?: boolean;
  /** Fest Typ="Entdecker" — Java TalentbonusTyp.ENTDECKER */
  typ?: string;
}

export interface TraitBonusEntry {
  id?: string | null;
  variant?: string | null;
  rating?: number | null;
  open?: boolean;
  choices?: Array<{
    id: string;
    variant?: string | null;
    rating?: number | null;
  }>;
}

export interface SpecialAbilityBonusEntry {
  id?: string;
  variant?: string | null;
  talent?: string;
  open?: boolean;
  /** Java `<Gelaendekunde/>` open topography pick */
  kind?: string;
  choices?: Array<{
    id: string;
    variant?: string | null;
    talent?: string;
  }>;
}

export interface DiscountedSpecialEntry {
  id?: string;
  variant?: string | null;
  open?: boolean;
  choices?: Array<{
    id: string;
    variant?: string | null;
  }>;
}

/** Culture/profession ZauberBonus (Java `Zauberbonus`). */
export interface SpellBonusEntry {
  id: string;
  bonus?: number;
  house?: boolean;
  variant?: string | null;
}

export interface OpenTalentChoice {
  key: string;
  source: "race" | "culture" | "profession";
  type: "fixed" | "free";
  ranks: number[];
  points: number;
  talents: string[];
  /** Propagated from Fest Leittalent="true" */
  lead?: boolean;
}

export interface OpenTraitChoice {
  key: string;
  source: string;
  choices: NonNullable<TraitBonusEntry["choices"]>;
}

export interface OpenSpecialAbilityChoice {
  key: string;
  source: string;
  choices: NonNullable<SpecialAbilityBonusEntry["choices"]>;
}

export interface OpenCheapSpecialChoice {
  key: string;
  source: string;
  choices: Array<{ id: string; variant?: string | null }>;
}

function addTalentTp(talents: TalentWert[], id: string, delta: number) {
  const existing = talents.find((t) => t.id === id);
  if (existing) existing.tp += delta;
  else talents.push({ id, tp: delta });
}

function ensureTalent(talents: TalentWert[], id: string) {
  if (!talents.some((t) => t.id === id)) talents.push({ id, tp: 0 });
}

function applyFixedSingle(
  talents: TalentWert[],
  bonuses: TalentBonusEntry[] | undefined
) {
  for (const b of bonuses || []) {
    if (b.type !== "fixed") continue;
    if (b.open || (b.talents?.length ?? 0) !== 1) continue;
    const id = b.talents![0];
    const ranks =
      b.bonuses && b.bonuses.length ? b.bonuses : [b.bonus ?? 0];
    for (const r of ranks) addTalentTp(talents, id, r);
  }
}

/**
 * Java `TalentbonusFestAlteSprache`: if mother tongue is Garethi → Bosparano
 * gets the higher bonus and Proto-Tulamidyan the lower; reversed for Tulamidyan.
 */
function applyAncientLanguageBonuses(
  talents: TalentWert[],
  bonuses: TalentBonusEntry[] | undefined,
  motherTongue: string | undefined
) {
  for (const b of bonuses || []) {
    if (b.type !== "ancient_language") continue;
    const ranks = (b.bonuses && b.bonuses.length
      ? [...b.bonuses]
      : [b.bonus ?? 0]
    )
      .filter((n) => Number.isFinite(n))
      .sort((a, c) => c - a);
    if (!ranks.length) continue;
    const higher = ranks[0];
    const lower = ranks[1] ?? 0;
    if (motherTongue === "Talent.Garethi") {
      addTalentTp(talents, "Talent.Bosparano", higher);
      addTalentTp(talents, "Talent.UrTulamidya", lower);
    } else if (motherTongue === "Talent.Tulamidya") {
      addTalentTp(talents, "Talent.Bosparano", lower);
      addTalentTp(talents, "Talent.UrTulamidya", higher);
    }
  }
}

function collectOpenBonuses(
  source: OpenTalentChoice["source"],
  bonuses: TalentBonusEntry[] | undefined
): OpenTalentChoice[] {
  const out: OpenTalentChoice[] = [];
  let i = 0;
  for (const b of bonuses || []) {
    const talents = b.talents || [];
    if (b.type === "free") {
      out.push({
        key: `${source}-free-${i++}`,
        source,
        type: "free",
        ranks: [],
        points: Number(b.points ?? b.bonus ?? 0),
        talents,
        lead: Boolean(b.lead),
      });
      continue;
    }
    if (b.type === "fixed" && isExpandableOpenTalentBonus(b)) {
      const ranks =
        b.bonuses && b.bonuses.length ? b.bonuses : [b.bonus ?? 0];
      out.push({
        key: `${source}-fixed-${i++}`,
        source,
        type: "fixed",
        ranks,
        points: 0,
        talents,
        lead: Boolean(b.lead),
      });
    }
  }
  return out;
}

function applyTraitBonuses(
  traits: TraitWert[],
  bonuses: TraitBonusEntry[] | undefined
) {
  for (const b of bonuses || []) {
    if (b.open || !b.id) continue;
    if (traits.some((t) => t.id === b.id)) continue;
    traits.push({
      id: b.id,
      variant: b.variant || undefined,
      rating: b.rating ?? undefined,
      granted: true,
      grantedRating: b.rating ?? undefined,
    });
  }
}

function applySpecialBonuses(
  held: HeldModel,
  bonuses: Array<{
    id?: string;
    variant?: string | null;
    talent?: string;
    open?: boolean;
  }> | undefined
) {
  for (const b of bonuses || []) {
    // Open multi-choice / terrain-knowledge Fest — resolved via openSpecialPicks
    if (b.open || !b.id) continue;
    if (
      held.specialAbilities.some(
        (s) =>
          s.id === b.id &&
          (s.talent || "") === (b.talent || "") &&
          (s.variant || "") === (b.variant || "")
      )
    ) {
      continue;
    }
    held.specialAbilities.push({
      id: b.id,
      talent: b.talent || undefined,
      variant: b.variant || undefined,
    });
  }
}

function applySpecialAbilityStrings(held: HeldModel, list: string[] | undefined) {
  for (const id of list || []) {
    if (!id) continue;
    if (held.specialAbilities.some((s) => s.id === id && !s.talent)) continue;
    held.specialAbilities.push({ id });
  }
}

function applyDiscounted(
  held: HeldModel,
  list: Array<{ id?: string; open?: boolean }> | string[] | undefined
) {
  for (const item of list || []) {
    if (typeof item !== "string" && item.open) continue; // cheap terrain pick via openCheapSpecialPick
    const id = typeof item === "string" ? item : item.id;
    if (!id) continue;
    if (!held.discountedSpecialAbilities.includes(id)) {
      held.discountedSpecialAbilities.push(id);
    }
  }
}

function applyDiscountedVariants(
  held: HeldModel,
  list:
    | Array<{
        id?: string;
        variant?: string | null;
        talent?: string | null;
        description?: string | null;
      }>
    | undefined
) {
  for (const item of list || []) {
    if (!item?.id) continue;
    // Baustein VerbilligteVarianten often store free-text in Beschreibung, not Variante.
    const variant = item.variant || item.description || undefined;
    const talent = item.talent || undefined;
    const already = held.discountedSpecialAbilityVariants.some(
      (v) => v.id === item.id && v.variant === variant && v.talent === talent
    );
    if (already) continue;
    held.discountedSpecialAbilityVariants.push({
      id: item.id,
      variant,
      talent,
    });
  }
}

function applyOpenTalentAssignments(
  talents: TalentWert[],
  open: OpenTalentChoice[],
  assignments: Record<string, string[]>
) {
  for (const choice of open) {
    const picks = assignments[choice.key] || [];
    if (choice.type === "fixed") {
      const used = new Set<string>();
      choice.ranks.forEach((rank, idx) => {
        const talentId = picks[idx];
        if (!talentId || used.has(talentId)) return;
        used.add(talentId);
        addTalentTp(talents, talentId, rank);
      });
    } else if (choice.type === "free") {
      for (const talentId of picks.slice(0, choice.points)) {
        addTalentTp(talents, talentId, 1);
      }
    }
  }
}

function computeSeededTalents(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  opts: {
    secondLanguage?: string;
    openAssignments?: Record<string, string[]>;
  }
): TalentWert[] {
  const talents: TalentWert[] = [];
  // Mirror Java Held ctor — seed all Basis talents at TP 0 before package bonuses.
  for (const id of BASIC_TALENT_IDS) {
    ensureTalent(talents, id);
  }
  applyFixedSingle(talents, race?.talent_bonuses as TalentBonusEntry[]);
  applyFixedSingle(talents, culture?.talent_bonuses as TalentBonusEntry[]);
  applyFixedSingle(talents, profession?.talent_bonuses as TalentBonusEntry[]);

  const mother = culture?.mother_tongue
    ? String(culture.mother_tongue)
    : undefined;
  if (mother) ensureTalent(talents, mother);

  const secondOptions = (culture?.second_languages as string[]) || [];
  let second = opts.secondLanguage || "";
  if (!second && secondOptions.length === 1) second = secondOptions[0];
  if (second && secondOptions.length && !secondOptions.includes(second)) {
    second = "";
  }
  if (second) ensureTalent(talents, second);

  // After mother tongue is known — mirrors Java istDirektAnwendbar AlteSprache
  applyAncientLanguageBonuses(
    talents,
    race?.talent_bonuses as TalentBonusEntry[],
    mother
  );
  applyAncientLanguageBonuses(
    talents,
    culture?.talent_bonuses as TalentBonusEntry[],
    mother
  );
  applyAncientLanguageBonuses(
    talents,
    profession?.talent_bonuses as TalentBonusEntry[],
    mother
  );

  const open = listOpenTalentBonuses(race, culture, profession);
  applyOpenTalentAssignments(
    talents,
    open,
    opts.openAssignments || {}
  );
  return talents;
}

/** Language TP modification during creation: mother CL−2, second CL−4. */
export function languageTpMod(
  held: HeldModel,
  talentId: string,
  attributeMods?: AttributeMods
): number {
  const cl = currentAttrValue(held, "CL", attributeMods);
  if (held.motherTongue === talentId) return cl - 2;
  if (held.secondLanguage === talentId) return cl - 4;
  return 0;
}

export function effectiveTalentTp(
  held: HeldModel,
  talentId: string,
  baseTp: number,
  attributeMods?: AttributeMods
): number {
  return baseTp + languageTpMod(held, talentId, attributeMods);
}

export function listOpenTalentBonuses(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): OpenTalentChoice[] {
  return [
    ...collectOpenBonuses(
      "race",
      race?.talent_bonuses as TalentBonusEntry[] | undefined
    ),
    ...collectOpenBonuses(
      "culture",
      culture?.talent_bonuses as TalentBonusEntry[] | undefined
    ),
    ...collectOpenBonuses(
      "profession",
      profession?.talent_bonuses as TalentBonusEntry[] | undefined
    ),
  ];
}

export function resolveOpenTalentChoiceOptions(
  choice: OpenTalentChoice,
  catalog: CatalogItem[],
  opts: {
    motherTongue?: string;
    secondLanguage?: string;
  } = {}
): string[] {
  return expandOpenTalentIds(choice.talents, catalog, opts);
}

export function listOpenTraitBonuses(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): OpenTraitChoice[] {
  const out: OpenTraitChoice[] = [];
  const sources: Array<[string, CatalogItem | null | undefined]> = [
    ["race", race],
    ["culture", culture],
    ["profession", profession],
  ];
  for (const [source, item] of sources) {
    const lists = [
      item?.advantage_bonuses as TraitBonusEntry[] | undefined,
      item?.disadvantage_bonuses as TraitBonusEntry[] | undefined,
    ];
    let i = 0;
    for (const list of lists) {
      for (const b of list || []) {
        if (b.open && b.choices?.length) {
          out.push({
            key: `${source}-vn-${i++}`,
            source,
            choices: b.choices,
          });
        }
      }
    }
  }
  return out;
}

function collectOpenSfBonuses(
  source: string,
  bonuses: SpecialAbilityBonusEntry[] | undefined
): OpenSpecialAbilityChoice[] {
  const out: OpenSpecialAbilityChoice[] = [];
  let i = 0;
  for (const b of bonuses || []) {
    if (b.open && b.choices?.length) {
      out.push({
        key: `${source}-sf-${i++}`,
        source,
        choices: b.choices,
      });
    } else if (b.open && !b.id && b.choices?.length) {
      out.push({
        key: `${source}-sf-${i++}`,
        source,
        choices: b.choices,
      });
    }
  }
  return out;
}

export function listOpenSpecialAbilityBonuses(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): OpenSpecialAbilityChoice[] {
  return [
    ...collectOpenSfBonuses(
      "race",
      race?.special_ability_bonuses as SpecialAbilityBonusEntry[] | undefined
    ),
    ...collectOpenSfBonuses(
      "culture",
      culture?.special_ability_bonuses as SpecialAbilityBonusEntry[] | undefined
    ),
    ...collectOpenSfBonuses(
      "profession",
      profession?.special_ability_bonuses as SpecialAbilityBonusEntry[] | undefined
    ),
  ];
}

export function listOpenCheapSpecialChoices(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): OpenCheapSpecialChoice[] {
  const out: OpenCheapSpecialChoice[] = [];
  const sources: Array<[string, CatalogItem | null | undefined]> = [
    ["race", race],
    ["culture", culture],
    ["profession", profession],
  ];
  for (const [source, item] of sources) {
    const list = item?.discounted_special_abilities as
      | DiscountedSpecialEntry[]
      | undefined;
    if (!list?.length) continue;
    // Only true open packs (e.g. Java <Gelaendekunde/>). Multiple fixed
    // <Sonderfertigkeit/> entries are all granted — never a pick-one UI.
    for (const entry of list) {
      if (entry.open && entry.choices?.length) {
        out.push({
          key: `${source}-cheap-sf`,
          source,
          choices: entry.choices,
        });
      }
    }
  }
  return out;
}

export function leadSpellPickCount(
  culture: CatalogItem | null | undefined
): number {
  const n = culture?.lead_spell_count ?? culture?.extra_lead_spells;
  return Number(n ?? 0) || 0;
}

/**
 * Union of race/culture/profession `<Leittalente>` lists and Fest
 * `Leittalent="true"` bonuses (including the talent chosen for open Fest).
 * Mirrors Java `einfuegenLeittalente` + `TalentbonusFest.istLeittalent`.
 * Open Fest with lead=true marks the chosen pick as lead (rules-correct;
 * Java UI path may omit this for multi-choice Fest).
 */
export function computeLeadTalents(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  openAssignments: Record<string, string[]> = {}
): string[] {
  const leads = new Set<string>();

  for (const src of [race, culture, profession]) {
    for (const id of (src?.lead_talents as string[] | undefined) || []) {
      if (id) leads.add(id);
    }
  }

  const addFestLeads = (bonuses: TalentBonusEntry[] | undefined) => {
    for (const b of bonuses || []) {
      if (!b.lead || b.type !== "fixed") continue;
      if (b.open || isExpandableOpenTalentBonus(b)) continue;
      const talents = b.talents || [];
      if (talents.length === 1) leads.add(talents[0]);
    }
  };
  addFestLeads(race?.talent_bonuses as TalentBonusEntry[] | undefined);
  addFestLeads(culture?.talent_bonuses as TalentBonusEntry[] | undefined);
  addFestLeads(profession?.talent_bonuses as TalentBonusEntry[] | undefined);

  for (const choice of listOpenTalentBonuses(race, culture, profession)) {
    if (!choice.lead) continue;
    for (const id of openAssignments[choice.key] || []) {
      if (id) leads.add(id);
    }
  }

  return [...leads];
}

/** Flatten culture + profession spell bonuses (max SP, house OR). */
export function collectSpellBonuses(
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): SpellBonusEntry[] {
  const map = new Map<string, SpellBonusEntry>();
  for (const src of [culture, profession]) {
    if (!src) continue;
    const list = (src.spell_bonuses as SpellBonusEntry[] | undefined) || [];
    if (list.length) {
      for (const b of list) {
        if (!b?.id) continue;
        const prev = map.get(b.id);
        if (!prev) {
          map.set(b.id, {
            id: b.id,
            bonus: Number(b.bonus ?? 0) || 0,
            house: Boolean(b.house),
            variant: b.variant ?? null,
          });
        } else {
          prev.bonus = Math.max(prev.bonus ?? 0, Number(b.bonus ?? 0) || 0);
          prev.house = Boolean(prev.house || b.house);
          if (!prev.variant && b.variant) prev.variant = b.variant;
        }
      }
      continue;
    }
    for (const id of (src.spells as string[]) || []) {
      if (!id || map.has(id)) continue;
      map.set(id, { id, bonus: 0, house: false, variant: null });
    }
  }
  return [...map.values()];
}

/** Package spells auto-marked lead when hero has Elven Worldview (Java anwendenZauber). */
export function packageAutoLeadSpellIds(
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  traits: TraitWert[]
): string[] {
  if (!traits.some((t) => t.id === ELFISCHE_WELTSICHT)) return [];
  return collectSpellBonuses(culture, profession).map((b) => b.id);
}

export function packageHouseSpellIds(
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): string[] {
  return collectSpellBonuses(culture, profession)
    .filter((b) => b.house)
    .map((b) => b.id);
}

function computeSeededSpells(
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): SpellWert[] {
  return collectSpellBonuses(culture, profession).map((b) => ({
    id: b.id,
    sp: Number(b.bonus ?? 0) || 0,
    baselineSp: Number(b.bonus ?? 0) || 0,
    variant: b.variant || undefined,
  }));
}

function mergeSpells(seeded: SpellWert[], existing: SpellWert[]): SpellWert[] {
  const seedMap = new Map(seeded.map((s) => [s.id, s]));
  const merged = seeded.map((s) => ({ ...s }));
  for (const s of existing) {
    const seed = seedMap.get(s.id);
    const row = merged.find((x) => x.id === s.id);
    if (row) {
      if (s.sp > row.sp) row.sp = s.sp;
      if (s.variant) row.variant = s.variant;
      if (s.activated != null) row.activated = s.activated;
      if (s.specialExperience != null) row.specialExperience = s.specialExperience;
      continue;
    }
    if (!seed) merged.push({ ...s });
  }
  return merged;
}

export function connectionPointsGranted(
  profession: CatalogItem | null | undefined
): number {
  const n = profession?.connection_points;
  return Number(n ?? 0) || 0;
}

export function professionSpecialItems(
  profession: CatalogItem | null | undefined
): string[] {
  return (profession?.special_items as string[]) || [];
}

function computeSeededTraits(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  openTraitPicks: Record<string, string>
): TraitWert[] {
  const traits: TraitWert[] = [];
  applyTraitBonuses(traits, race?.advantage_bonuses as TraitBonusEntry[]);
  applyTraitBonuses(traits, race?.disadvantage_bonuses as TraitBonusEntry[]);
  applyTraitBonuses(traits, culture?.advantage_bonuses as TraitBonusEntry[]);
  applyTraitBonuses(traits, culture?.disadvantage_bonuses as TraitBonusEntry[]);
  applyTraitBonuses(traits, profession?.advantage_bonuses as TraitBonusEntry[]);
  applyTraitBonuses(
    traits,
    profession?.disadvantage_bonuses as TraitBonusEntry[]
  );

  for (const choice of listOpenTraitBonuses(race, culture, profession)) {
    const pickId = openTraitPicks[choice.key];
    if (!pickId) continue;
    const picked = choice.choices.find((c) => c.id === pickId);
    if (!picked || traits.some((t) => t.id === picked.id)) continue;
    traits.push({
      id: picked.id,
      variant: picked.variant || undefined,
      rating: picked.rating ?? undefined,
      granted: true,
    });
  }
  return traits;
}

function mergeTalents(
  seeded: TalentWert[],
  existing: TalentWert[]
): TalentWert[] {
  const seedMap = new Map(seeded.map((t) => [t.id, t.tp]));
  const merged = seeded.map((t) => ({ ...t }));
  for (const t of existing) {
    const seedTp = seedMap.get(t.id) ?? 0;
    const row = merged.find((x) => x.id === t.id);
    if (row) {
      if (t.tp > seedTp) row.tp = t.tp;
      if (t.attack != null) row.attack = t.attack;
      if (t.activated != null) row.activated = t.activated;
      if (t.specialExperience != null) row.specialExperience = t.specialExperience;
      continue;
    }
    if (
      !seedMap.has(t.id) &&
      (t.tp > 0 || t.activated || (t.attack ?? 0) > 0)
    ) {
      merged.push({ ...t });
    }
  }
  return merged;
}

function mergeTraits(
  seeded: TraitWert[],
  existing: TraitWert[]
): TraitWert[] {
  const seedIds = new Set(seeded.map((t) => t.id));
  const merged = [...seeded];
  for (const t of existing) {
    if (!seedIds.has(t.id)) merged.push(t);
  }
  return merged;
}

function mergeSpecialAbilities(
  seeded: HeldModel["specialAbilities"],
  existing: HeldModel["specialAbilities"],
  grantedIds: Set<string>
): HeldModel["specialAbilities"] {
  const key = (s: { id: string; talent?: string; variant?: string }) =>
    `${s.id}|${s.talent || ""}|${s.variant || ""}`;
  const seedKeys = new Set(seeded.map(key));
  const merged = [...seeded];
  for (const s of existing) {
    if (seedKeys.has(key(s))) continue;
    if (grantedIds.has(s.id)) continue;
    merged.push(s);
  }
  return merged;
}

/**
 * Re-apply only open talent bonus assignments without wiping traits/SFs.
 */
export function reapplyOpenTalentBonuses(
  held: HeldModel,
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  opts: {
    secondLanguage?: string;
    openAssignments?: Record<string, string[]>;
  } = {}
): HeldModel {
  const seeded = computeSeededTalents(race, culture, profession, opts);
  return {
    ...held,
    motherTongue: culture?.mother_tongue
      ? String(culture.mother_tongue)
      : undefined,
    secondLanguage: opts.secondLanguage || held.secondLanguage,
    talents: mergeTalents(seeded, held.talents),
    leadTalents: computeLeadTalents(
      race,
      culture,
      profession,
      opts.openAssignments || {}
    ),
  };
}

/**
 * Rebuild seeded talents/traits/SAs from race+culture+profession fixed bonuses.
 * Preserves user-purchased raises beyond seeds when mode is merge (default).
 */
export function applyFixedBausteine(
  held: HeldModel,
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  opts: {
    secondLanguage?: string;
    openAssignments?: Record<string, string[]>;
    openTraitPicks?: Record<string, string>;
    openSpecialPicks?: Record<string, string>;
    openCheapSpecialPick?: string;
    leadSpellPicks?: string[];
    mode?: "full" | "open-talents-only";
  } = {}
): HeldModel {
  if (opts.mode === "open-talents-only") {
    return reapplyOpenTalentBonuses(held, race, culture, profession, opts);
  }

  const seededTalents = computeSeededTalents(race, culture, profession, opts);
  const seededTraits = computeSeededTraits(
    race,
    culture,
    profession,
    opts.openTraitPicks || {}
  );
  const seededSpells = computeSeededSpells(culture, profession);
  const autoLead = packageAutoLeadSpellIds(culture, profession, seededTraits);
  const house = packageHouseSpellIds(culture, profession);
  const pickLeads = (opts.leadSpellPicks || []).filter(
    (id) => !autoLead.includes(id)
  );
  const leadSpells = [...new Set([...autoLead, ...pickLeads])];
  const leadTalents = computeLeadTalents(
    race,
    culture,
    profession,
    opts.openAssignments || {}
  );

  const seededHeld: HeldModel = {
    ...emptyHeldSlice(held),
    talents: [...seededTalents],
    spells: [...seededSpells],
    advantagesDisadvantages: [...seededTraits],
    specialAbilities: [],
    discountedSpecialAbilities: [],
    discountedSpecialAbilityVariants: [],
    leadTalents,
    leadSpells,
    houseSpells: house,
  };

  applySpecialBonuses(
    seededHeld,
    race?.special_ability_bonuses as SpecialAbilityBonusEntry[]
  );
  applySpecialBonuses(
    seededHeld,
    culture?.special_ability_bonuses as SpecialAbilityBonusEntry[]
  );
  applySpecialBonuses(
    seededHeld,
    profession?.special_ability_bonuses as SpecialAbilityBonusEntry[]
  );
  applySpecialAbilityStrings(
    seededHeld,
    race?.special_abilities as string[] | undefined
  );
  applySpecialAbilityStrings(
    seededHeld,
    culture?.special_abilities as string[] | undefined
  );
  applySpecialAbilityStrings(
    seededHeld,
    profession?.special_abilities as string[] | undefined
  );

  for (const choice of listOpenSpecialAbilityBonuses(
    race,
    culture,
    profession
  )) {
    const pick = opts.openSpecialPicks?.[choice.key];
    if (!pick) continue;
    const picked = choice.choices.find((c) => c.id === pick);
    if (picked) {
      seededHeld.specialAbilities.push({
        id: picked.id,
        talent: picked.talent,
        variant: picked.variant || undefined,
      });
    }
  }

  applyDiscounted(
    seededHeld,
    race?.discounted_special_abilities as Array<{ id?: string }>
  );
  applyDiscounted(
    seededHeld,
    culture?.discounted_special_abilities as Array<{ id?: string }>
  );
  applyDiscounted(
    seededHeld,
    profession?.discounted_special_abilities as Array<{ id?: string }>
  );
  applyDiscountedVariants(
    seededHeld,
    culture?.discounted_special_ability_variants as Array<{
      id?: string;
      variant?: string | null;
    }>
  );
  applyDiscountedVariants(
    seededHeld,
    profession?.discounted_special_ability_variants as Array<{
      id?: string;
      variant?: string | null;
    }>
  );

  if (opts.openCheapSpecialPick) {
    if (
      !seededHeld.discountedSpecialAbilities.includes(
        opts.openCheapSpecialPick
      )
    ) {
      seededHeld.discountedSpecialAbilities.push(opts.openCheapSpecialPick);
    }
  }

  const grantedIds = new Set(
    seededHeld.specialAbilities.map((s) => s.id)
  );

  const mother = culture?.mother_tongue
    ? String(culture.mother_tongue)
    : undefined;
  const secondOptions = (culture?.second_languages as string[]) || [];
  let second = opts.secondLanguage || held.secondLanguage || "";
  if (!second && secondOptions.length === 1) second = secondOptions[0];
  if (second && secondOptions.length && !secondOptions.includes(second)) {
    second = "";
  }

  return {
    ...held,
    motherTongue: mother,
    secondLanguage: second || undefined,
    talents: mergeTalents(seededTalents, held.talents),
    spells: mergeSpells(seededSpells, held.spells),
    advantagesDisadvantages: mergeTraits(
      seededTraits,
      held.advantagesDisadvantages
    ),
    specialAbilities: mergeSpecialAbilities(
      seededHeld.specialAbilities,
      held.specialAbilities,
      grantedIds
    ),
    discountedSpecialAbilities: [
      ...new Set([
        ...seededHeld.discountedSpecialAbilities,
        ...held.discountedSpecialAbilities.filter(
          (id) => !seededHeld.discountedSpecialAbilities.includes(id)
        ),
      ]),
    ],
    discountedSpecialAbilityVariants: [
      ...seededHeld.discountedSpecialAbilityVariants,
      ...held.discountedSpecialAbilityVariants.filter(
        (v) =>
          !seededHeld.discountedSpecialAbilityVariants.some(
            (s) =>
              s.id === v.id &&
              s.variant === v.variant &&
              s.talent === v.talent
          )
      ),
    ],
    leadTalents,
    leadSpells,
    houseSpells: house,
  };
}

function emptyHeldSlice(held: HeldModel): HeldModel {
  return { ...held };
}

export function traitGpNet(
  held: HeldModel,
  catalog: CatalogItem[],
  talents: CatalogItem[] = []
): number {
  let sum = 0;
  for (const t of held.advantagesDisadvantages) {
    const meta = catalog.find((x) => x.id === t.id);
    if (!meta) continue;
    const ctx = {
      held,
      talents,
      variant: t.variant,
    };
    // Fully granted with no raisable levels above baseline → 0 GP
    if (t.granted && t.grantedRating == null && t.rating == null) {
      continue;
    }
    if (t.granted && t.grantedRating == null && t.rating != null) {
      // Legacy granted rows without grantedRating: treat current as free baseline
      continue;
    }
    if (t.grantedRating != null || t.granted) {
      sum += traitGpDelta(
        meta as TraitCatalogFields,
        t.rating,
        t.grantedRating ?? t.rating ?? 0,
        ctx
      );
      continue;
    }
    sum += estimateTraitGp(meta as TraitCatalogFields, t.rating, ctx);
  }
  return sum;
}

export function unsuitableTraitIds(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined
): Set<string> {
  const set = new Set<string>();
  for (const item of [race, culture, profession]) {
    for (const u of (item?.unsuitable_advantages_disadvantages as
      | Array<{ id: string }>
      | undefined) || []) {
      if (u?.id) set.add(u.id);
    }
  }
  return set;
}

export function seededTalentIds(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  opts: {
    secondLanguage?: string;
    openAssignments?: Record<string, string[]>;
  } = {}
): Set<string> {
  return new Set(
    computeSeededTalents(race, culture, profession, opts).map((t) => t.id)
  );
}

export function seededTalentMinimums(
  race: CatalogItem | null | undefined,
  culture: CatalogItem | null | undefined,
  profession: CatalogItem | null | undefined,
  opts: {
    secondLanguage?: string;
    openAssignments?: Record<string, string[]>;
  } = {}
): Map<string, number> {
  return new Map(
    computeSeededTalents(race, culture, profession, opts).map((t) => [
      t.id,
      t.tp,
    ])
  );
}
