/**
 * Package spells, caster tradition, and SKT column shifts for the random generator.
 * Aligns with Java Chargen `ErschaffungManager.anwendenZauber` / `KostenStandard`.
 */

import spellsData from "@/data/magic/spells.json";
import culturesData from "@/data/core/cultures.json";
import professionsData from "@/data/core/professions.json";

/** True elven peoples for profession requirements that still encode `"race":"elf"`. */
export const ELF_KIND_PROFESSION_RACE_IDS = new Set([
  "elf",
  "forest_elf",
  "firn_elf",
]);

export function satisfiesProfessionRaceRequirement(
  requirementRaceId: string,
  heroRaceId: string,
): boolean {
  if (requirementRaceId === heroRaceId) return true;
  return (
    requirementRaceId === "elf" &&
    ELF_KIND_PROFESSION_RACE_IDS.has(heroRaceId)
  );
}

const SPELL_DEF_BY_ID = new Map(
  spellsData.spells.map(
    (s): [string, (typeof spellsData.spells)[number]] => [s.id, s],
  ),
);

const SPELL_ID_BY_GERMAN = new Map<string, string>();
for (const s of spellsData.spells) {
  const g = (s.german_name ?? "").trim().toLowerCase();
  if (g && !SPELL_ID_BY_GERMAN.has(g)) SPELL_ID_BY_GERMAN.set(g, s.id);
}

/** Legacy / Java / culture JSON ids → `data/magic/spells.json` catalog ids. */
const SPELL_ID_ALIASES: Record<string, string> = {
  attributo: "attributio",
  attributio: "attributio",
  balm_of_healing: "balm_of_healing",
  bannbaladin: "be_my_friend",
  be_my_friend: "be_my_friend",
  flim_flam: "flim_flam_funkel",
  flim_flam_funkel: "flim_flam_funkel",
  fulminictus: "thunderbolt",
  thunderbolt: "thunderbolt",
  sensibar: "sensibar",
  AnalysArcanstruktur: "analytica_arcana",
  analytica_arcana: "analytica_arcana",
  Armatrutz: "fastness_of_body",
  AurisNasusOculus: "auris_nasis_oculus",
  BalsamSalabunde: "balm_of_healing",
  BlitzDichFind: "move_as_the_lightning",
  ClaudibusClavistibor: "claudibus_clavistibor",
  ForamenForaminor: "foramen_foraminor",
  FulminictusDonnerkeil: "thunderbolt",
  GardianumZauberschild: "gardianum",
  OdemArcanum: "breath_of_magic_odem_arcanum",
  ParalysisStarrWieStein: "paralyze",
  SilentiumSchweigekreis: "silence_reigns_supreme",
  SomnigravisTieferSchlaf: "sleep_of_a_thousand_sheep",
  AdleraugeLuchsenohr: "eye_of_eagle_ear_of_lynx",
  AdlerschwingeWolfsgestalt: "adlerschwinge",
  ExposamiLebenskraft: "exposami",
  MovimentoDauerlauf: "movimento",
  NebelwandUndMorgendunst: "fog_flow_far",
  VisibiliVanitar: "unseen",
  WeisseMaehnUndGoldnerHuf: "white_mane",
  BlickInDieGedanken: "see_true_and_pure",
  GedankenbilderElfenruf: "gedankenbilder",
  EinflussBannen: "einfluss_bannen",
  ElfenstimmeFloetenton: "elfenstimme",
  Sanftmut: "gentle_disposition",
  SeidenzungeElfenwort: "silver_tongue",
};

export type SpellCasterRole = "guild_magician" | "elf" | "general";

export type PackageSpell = {
  id: string;
  sp: number;
  isHouse: boolean;
};

export type SpellDef = (typeof spellsData.spells)[number];

export function resolveSpellCatalogId(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const stripped = t.replace(/^Zauber\./, "");
  if (SPELL_DEF_BY_ID.has(t)) return t;
  if (SPELL_DEF_BY_ID.has(stripped)) return stripped;
  const aliased = SPELL_ID_ALIASES[t] ?? SPELL_ID_ALIASES[stripped];
  if (aliased && SPELL_DEF_BY_ID.has(aliased)) return aliased;
  const byDe = SPELL_ID_BY_GERMAN.get(stripped.toLowerCase());
  return byDe ?? null;
}

function mergePackage(into: Map<string, PackageSpell>, id: string, sp: number, isHouse: boolean) {
  const prev = into.get(id);
  if (!prev) {
    into.set(id, { id, sp, isHouse });
    return;
  }
  into.set(id, {
    id,
    sp: Math.max(prev.sp, sp),
    isHouse: prev.isHouse || isHouse,
  });
}

function ingestStartingSpellArray(
  into: Map<string, PackageSpell>,
  rows: unknown,
) {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as {
      spell?: unknown;
      id?: unknown;
      sp?: unknown;
      value?: unknown;
      bonus?: unknown;
      is_house_spell?: unknown;
      house?: unknown;
    };
    const rawId = typeof r.spell === "string" ? r.spell : typeof r.id === "string" ? r.id : "";
    const id = resolveSpellCatalogId(rawId);
    if (!id) continue;
    const spRaw = r.sp ?? r.value ?? r.bonus ?? 0;
    const sp = typeof spRaw === "number" && Number.isFinite(spRaw) ? spRaw : 0;
    const isHouse = r.is_house_spell === true || r.house === true;
    mergePackage(into, id, sp, isHouse);
  }
}

function ingestSpellModifierMap(
  into: Map<string, PackageSpell>,
  mods: unknown,
) {
  if (!mods || typeof mods !== "object" || Array.isArray(mods)) return;
  for (const [rawId, rawVal] of Object.entries(mods as Record<string, unknown>)) {
    const id = resolveSpellCatalogId(rawId);
    if (!id) continue;
    if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      mergePackage(into, id, rawVal, false);
      continue;
    }
    if (rawVal && typeof rawVal === "object") {
      const v = rawVal as { value?: unknown; sp?: unknown; is_house_spell?: unknown; house?: unknown };
      const n = v.value ?? v.sp;
      const sp = typeof n === "number" && Number.isFinite(n) ? n : 0;
      mergePackage(into, id, sp, v.is_house_spell === true || v.house === true);
    }
  }
}

export function collectPackageSpells(
  culture: { automatic_starting_spells?: unknown } | null | undefined,
  profession: { spell_modifiers?: unknown } | null | undefined,
): PackageSpell[] {
  const into = new Map<string, PackageSpell>();
  ingestStartingSpellArray(into, culture?.automatic_starting_spells);
  const mods = profession?.spell_modifiers;
  if (Array.isArray(mods)) ingestStartingSpellArray(into, mods);
  else ingestSpellModifierMap(into, mods);
  return [...into.values()];
}

export function cultureLeadSpellCount(culture: { lead_spell_count?: unknown } | null | undefined): number {
  const n = culture?.lead_spell_count;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return Math.floor(n);
  return 0;
}

export function cultureHasElvishWorldView(
  culture: { automatic_disadvantages?: { id?: string }[] } | null | undefined,
): boolean {
  return (culture?.automatic_disadvantages ?? []).some((d) => d.id === "elvish_world_view");
}

export function resolveSpellCasterRole(args: {
  raceId: string;
  professionId: string;
  halfElfFullCaster: boolean;
  profession: {
    id?: string;
    spell_tradition?: string;
    automatic_SAs?: { id?: string }[];
  } | null | undefined;
  culture: {
    automatic_disadvantages?: { id?: string }[];
    automatic_SAs?: { id?: string }[];
  } | null | undefined;
  saIds?: ReadonlySet<string>;
}): SpellCasterRole {
  const sa = new Set(args.saIds ?? []);
  for (const row of args.profession?.automatic_SAs ?? []) {
    if (row.id) sa.add(row.id);
  }
  for (const row of args.culture?.automatic_SAs ?? []) {
    if (row.id) sa.add(row.id);
  }
  const tradition = args.profession?.spell_tradition;
  if (
    args.professionId === "magician" ||
    tradition === "guild_magic" ||
    sa.has("representation_guild_magic")
  ) {
    return "guild_magician";
  }
  if (
    ELF_KIND_PROFESSION_RACE_IDS.has(args.raceId) ||
    args.halfElfFullCaster ||
    tradition === "elven_heritage" ||
    sa.has("elven_representation") ||
    cultureHasElvishWorldView(args.culture)
  ) {
    return "elf";
  }
  return "general";
}

export function spellApplicable(spell: SpellDef, role: SpellCasterRole): boolean {
  const tr = spell.traditions ?? [];
  if (role === "guild_magician")
    return tr.includes("guild_magic") || tr.includes("general");
  if (role === "elf")
    return tr.includes("elven_heritage") || tr.includes("general");
  return tr.includes("general");
}

export function isOwnRepresentationForSpell(
  spell: SpellDef,
  role: SpellCasterRole,
): boolean {
  const tr = spell.traditions ?? [];
  if (role === "guild_magician")
    return tr.includes("guild_magic") || tr.includes("general");
  if (role === "elf")
    return tr.includes("elven_heritage") || tr.includes("general");
  return tr.includes("general");
}

const SKT_COL_ORDER = [
  "A_STAR",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
] as const;

export function shiftSpellColumn(col: string, delta: number): string {
  const idx = SKT_COL_ORDER.indexOf(col as (typeof SKT_COL_ORDER)[number]);
  if (idx < 0) return col;
  const next = Math.min(SKT_COL_ORDER.length - 1, Math.max(0, idx + delta));
  return SKT_COL_ORDER[next]!;
}

/**
 * Java `KostenStandard.getSteigerungsspalte`:
 * foreign representation +2; house −1; else Elven Worldview and not a lead spell +1.
 */
export function effectiveSpellColumn(
  spell: SpellDef,
  opts: {
    role: SpellCasterRole;
    isHouse: boolean;
    isLead: boolean;
    elvishWorldView: boolean;
  },
): string {
  const base = spell.advancement_column ?? "A";
  let shift = 0;
  if (!isOwnRepresentationForSpell(spell, opts.role)) shift += 2;
  if (opts.isHouse) shift -= 1;
  else if (opts.elvishWorldView && !opts.isLead) shift += 1;
  return shift === 0 ? base : shiftSpellColumn(base, shift);
}

export function lookupCulture(cultureId: string) {
  return culturesData.cultures.find((c) => c.id === cultureId);
}

export function lookupProfession(professionId: string) {
  return professionsData.professions.find((p) => p.id === professionId);
}

export function getSpellDef(id: string): SpellDef | undefined {
  return SPELL_DEF_BY_ID.get(id);
}
