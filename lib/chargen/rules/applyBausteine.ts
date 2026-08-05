/**
 * Apply race/culture/profession fixed bonuses — mirrors
 * ErschaffungManager.anwendenTalentBoniRasseKultur / Profession.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel, TalentWert, TraitWert } from "@/lib/chargen/types";
import { currentAttrValue, type AttributeMods } from "@/lib/chargen/types";
import { estimateTraitGp, type TraitCatalogFields } from "@/lib/chargen/rules/traitLabels";
import {
  expandOpenTalentIds,
  isExpandableOpenTalentBonus,
} from "@/lib/chargen/rules/talentListMarkers";

export interface TalentBonusEntry {
  type: "fixed" | "free";
  bonus?: number;
  bonuses?: number[];
  points?: number;
  talents?: string[];
  open?: boolean;
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

export interface OpenTalentChoice {
  key: string;
  source: "race" | "culture" | "profession";
  type: "fixed" | "free";
  ranks: number[];
  points: number;
  talents: string[];
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
    });
  }
}

function applySpecialBonuses(
  held: HeldModel,
  bonuses: Array<{ id?: string; variant?: string | null; talent?: string }> | undefined
) {
  for (const b of bonuses || []) {
    if (!b.id) continue;
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
  list: Array<{ id?: string }> | string[] | undefined
) {
  for (const item of list || []) {
    const id = typeof item === "string" ? item : item.id;
    if (!id) continue;
    if (!held.discountedSpecialAbilities.includes(id)) {
      held.discountedSpecialAbilities.push(id);
    }
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
    const openEntry = list.find((x) => x.open && x.choices?.length);
    if (openEntry?.choices) {
      out.push({
        key: `${source}-cheap-sf`,
        source,
        choices: openEntry.choices,
      });
      continue;
    }
    if (list.length > 1 && list.every((x) => x.id && !x.open)) {
      out.push({
        key: `${source}-cheap-sf-pick`,
        source,
        choices: list.map((x) => ({
          id: x.id!,
          variant: x.variant,
        })),
      });
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

  const seededHeld: HeldModel = {
    ...emptyHeldSlice(held),
    talents: [...seededTalents],
    advantagesDisadvantages: [...seededTraits],
    specialAbilities: [],
    discountedSpecialAbilities: [],
    leadTalents: [],
    leadSpells: opts.leadSpellPicks || [],
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
    leadSpells: opts.leadSpellPicks ?? held.leadSpells,
  };
}

function emptyHeldSlice(held: HeldModel): HeldModel {
  return { ...held };
}

export function traitGpNet(
  held: HeldModel,
  catalog: CatalogItem[]
): number {
  let sum = 0;
  for (const t of held.advantagesDisadvantages) {
    const meta = catalog.find((x) => x.id === t.id);
    if (!meta) continue;
    sum += estimateTraitGp(meta as TraitCatalogFields, t.rating);
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
