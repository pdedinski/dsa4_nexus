/**
 * Prerequisite / conflict checks — mirrors Java `Voraussetzung` packages (simplified).
 */

import type { AttrCodeWithSo, AttributeMods, HeldModel } from "@/lib/chargen/types";
import {
  ATTR_LABELS,
  currentAttrValue,
  talentTp,
} from "@/lib/chargen/types";
import {
  isCultureAllowedForRace,
  isProfessionAllowedForCulture,
} from "@/lib/chargen/rules/availability";
import { hasTrait } from "@/lib/chargen/rules/kosten";
import { countNonSeededActivations } from "@/lib/chargen/rules/talentActivation";

export type KonfliktSection =
  | "general"
  | "race"
  | "culture"
  | "profession"
  | "attributes"
  | "talents"
  | "spells"
  | "special_abilities"
  | "traits"
  | "budget";

export interface Konflikt {
  code: string;
  message: string;
  severity: "error" | "warning";
  /** Java PanelProbleme section grouping. */
  section?: KonfliktSection;
}

const BEGABUNG_TALENT = "VorNachteil.BegabungFuerTalent";
const BEGABUNG_GRUPPE = "VorNachteil.BegabungFuerTalentgruppe";
const UNFAEHIGKEIT_TALENT = "VorNachteil.UnfaehigkeitFuerTalent";
const UNFAEHIGKEIT_GRUPPE = "VorNachteil.UnfaehigkeitFuerTalentgruppe";

export function checkBegabungUnfaehigkeit(held: HeldModel): Konflikt[] {
  const out: Konflikt[] = [];
  const hasBegTalent = hasTrait(held, BEGABUNG_TALENT);
  const hasUnfTalent = hasTrait(held, UNFAEHIGKEIT_TALENT);
  const hasBegGruppe = hasTrait(held, BEGABUNG_GRUPPE);
  const hasUnfGruppe = hasTrait(held, UNFAEHIGKEIT_GRUPPE);

  if (hasBegTalent && hasUnfTalent) {
    out.push({
      code: "begabung_unfaehigkeit_talent",
      message:
        "Gifted (Talent) and Ineptitude (Talent) cannot both be active.",
      severity: "error",
      section: "traits",
    });
  }
  if (hasBegGruppe && hasUnfGruppe) {
    out.push({
      code: "begabung_unfaehigkeit_gruppe",
      message:
        "Gifted (Talent Group) and Ineptitude (Talent Group) cannot both be active.",
      severity: "error",
      section: "traits",
    });
  }
  return out;
}

export function checkMaxFiveVariantTraits(held: HeldModel): Konflikt[] {
  const counts = new Map<string, number>();
  for (const t of held.advantagesDisadvantages) {
    if (!t.variant) continue;
    counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
  }
  const out: Konflikt[] = [];
  for (const [id, n] of counts) {
    if (n > 5) {
      out.push({
        code: "max_5_variants",
        message: `${id} has more than 5 variants activated (${n}).`,
        severity: "error",
        section: "traits",
      });
    }
  }
  return out;
}

/** Kulturkunde variant → related language talent ids (Java `Kulturkunde.java`). */
const KULTURKUNDE_LANGUAGES: Record<string, string[]> = {
  "Kulturkunde.Almada": ["Talent.Garethi"],
  "Kulturkunde.Amazonen": ["Talent.Garethi"],
  "Kulturkunde.Ambosszwerge": ["Talent.Rogolan"],
  "Kulturkunde.AndergastNostria": ["Talent.Garethi"],
  "Kulturkunde.Aranien": ["Talent.Garethi", "Talent.Tulamidya"],
  "Kulturkunde.ArchaischeAchaz": ["Talent.Rssahh"],
  "Kulturkunde.Auelfen": ["Talent.Isdira"],
  "Kulturkunde.Bornland": ["Talent.Garethi"],
  "Kulturkunde.Brilliantzwerge": ["Talent.Rogolan"],
  "Kulturkunde.Bukanier": ["Talent.Garethi"],
  "Kulturkunde.Erzzwerge": ["Talent.Rogolan"],
  "Kulturkunde.Ferkina": ["Talent.Tulamidya"],
  "Kulturkunde.Firnelfen": ["Talent.Isdira"],
  "Kulturkunde.Fjarninger": ["Talent.Thorwalsch"],
  "Kulturkunde.Gjalskerlaender": ["Talent.Thorwalsch"],
  "Kulturkunde.Goblins": ["Talent.Goblinisch"],
  "Kulturkunde.Grolme": ["Talent.Garethi"],
  "Kulturkunde.Horasreich": ["Talent.Garethi"],
  "Kulturkunde.Huegelzwerge": ["Talent.Rogolan"],
  "Kulturkunde.Nivesen": ["Talent.Nujuka"],
  "Kulturkunde.Norbarden": ["Talent.Nujuka", "Talent.Garethi"],
  "Kulturkunde.NordaventurischeStaedte": ["Talent.Garethi"],
  "Kulturkunde.Maraskan": ["Talent.Garethi"],
  "Kulturkunde.Mohas": ["Talent.Mohisch"],
  "Kulturkunde.Mittelreich": ["Talent.Garethi"],
  "Kulturkunde.Novadi": ["Talent.Tulamidya"],
  "Kulturkunde.Orks": ["Talent.Oloarkh", "Talent.Ologhaijan"],
  "Kulturkunde.SchwarzeLande": ["Talent.Garethi"],
  "Kulturkunde.StammesAchaz": ["Talent.Rssahh"],
  "Kulturkunde.Steppenelfen": ["Talent.Isdira"],
  "Kulturkunde.Suedaventurien": ["Talent.Garethi"],
  "Kulturkunde.Svellttal": ["Talent.Garethi"],
  "Kulturkunde.Thorwal": ["Talent.Thorwalsch"],
  "Kulturkunde.Tocamuyac": ["Talent.Mohisch"],
  "Kulturkunde.Trolle": ["Talent.Garethi"],
  "Kulturkunde.Trollzacker": ["Talent.Garethi"],
  "Kulturkunde.Tulamidenlande": ["Talent.Tulamidya"],
  "Kulturkunde.Waldelfen": ["Talent.Isdira"],
  "Kulturkunde.Zahori": ["Talent.Tulamidya"],
  "Kulturkunde.Zyklopeninseln": ["Talent.Garethi"],
};

const KULTURKUNDE_LANG_MIN = 5;

/** Kulturkunde: related language talent TP ≥ 5 for the chosen culture variant. */
export function checkKulturkunde(
  held: HeldModel,
  resolveName?: (id: string) => string
): Konflikt[] {
  const kk = held.specialAbilities.filter(
    (s) => s.id === "Sonderfertigkeit.Kulturkunde"
  );
  if (!kk.length) return [];

  const out: Konflikt[] = [];
  for (const sa of kk) {
    const variant = sa.variant || "";
    const variantKey = variant.startsWith("Kulturkunde.")
      ? variant
      : variant
        ? `Kulturkunde.${variant.replace(/^Kultur\./, "")}`
        : "";
    const relatedLangs = variantKey
      ? KULTURKUNDE_LANGUAGES[variantKey] || []
      : [];
    const ok = relatedLangs.some(
      (langId) => talentTp(held, langId) >= KULTURKUNDE_LANG_MIN
    );
    if (!ok) {
      const variantLabel =
        resolveName?.(variant) ||
        variant.replace(/^Kulturkunde\./, "") ||
        "variant";
      const langNames = relatedLangs
        .map((id) => resolveName?.(id) || id.replace(/^Talent\./, ""))
        .join(" or ");
      out.push({
        code: "kulturkunde_language",
        message: langNames
          ? `Culture Lore (${variantLabel}) requires ${langNames} at TP ≥ ${KULTURKUNDE_LANG_MIN}.`
          : `Culture Lore (${variantLabel}) requires a related language at TP ≥ ${KULTURKUNDE_LANG_MIN}.`,
        severity: "warning",
        section: "special_abilities",
      });
    }
  }
  return out;
}

const MAX_GP_DISADVANTAGES = 50;
const MAX_GP_NEGATIVE_ATTRS = 30;
const MAX_TALENT_ACTIVATIONS = 5;
const MAX_SPELL_ACTIVATIONS = 7;

export function checkGpCaps(
  held: HeldModel,
  traits: Array<{ id: string; kind?: string; gp_cost?: number | null; gp_per_level?: number | null }>
): Konflikt[] {
  const out: Konflikt[] = [];
  const disGp = gpFromDisadvantagesList(held, traits);
  const negGp = gpFromNegativeAttributesList(held, traits);
  if (disGp > MAX_GP_DISADVANTAGES) {
    out.push({
      code: "gp_disadvantages_cap",
      message: `More than ${MAX_GP_DISADVANTAGES} GP from disadvantages (${disGp}).`,
      severity: "warning",
      section: "traits",
    });
  }
  if (negGp > MAX_GP_NEGATIVE_ATTRS) {
    out.push({
      code: "gp_negative_attrs_cap",
      message: `More than ${MAX_GP_NEGATIVE_ATTRS} GP from negative attributes (${negGp}).`,
      severity: "warning",
      section: "traits",
    });
  }
  return out;
}

function gpFromDisadvantagesList(
  held: HeldModel,
  traits: Array<{ id: string; kind?: string; gp_cost?: number | null; gp_per_level?: number | null }>
): number {
  let sum = 0;
  for (const t of held.advantagesDisadvantages) {
    const meta = traits.find((x) => x.id === t.id);
    if (!meta || meta.kind !== "disadvantage") continue;
    const gp = Number(meta.gp_cost ?? 0);
    if (gp < 0) sum += -gp;
    else if (meta.gp_per_level != null) {
      const per = Number(meta.gp_per_level);
      if (per < 0) sum += -per * (t.rating ?? 1);
    }
  }
  return sum;
}

function gpFromNegativeAttributesList(
  held: HeldModel,
  traits: Array<{ id: string; gp_cost?: number | null }>
): number {
  let sum = 0;
  for (const t of held.advantagesDisadvantages) {
    if (!t.id.includes("SchlechteEigenschaft")) continue;
    const meta = traits.find((x) => x.id === t.id);
    if (!meta) continue;
    const gp = Number(meta.gp_cost ?? 0);
    if (gp < 0) sum += -gp;
  }
  return sum;
}

export function checkActivationLimits(
  held: HeldModel,
  seededIds: Set<string>
): Konflikt[] {
  const out: Konflikt[] = [];
  const activations = countNonSeededActivations(held, seededIds);
  if (activations > MAX_TALENT_ACTIVATIONS) {
    out.push({
      code: "max_talent_activations",
      message: `More than ${MAX_TALENT_ACTIVATIONS} non-base talents activated (${activations}).`,
      severity: "warning",
      section: "talents",
    });
  }
  const spellActs = held.spells.filter(
    (s) => s.sp > 0 || s.activated !== false
  ).length;
  if (spellActs > MAX_SPELL_ACTIVATIONS) {
    out.push({
      code: "max_spell_activations",
      message: `More than ${MAX_SPELL_ACTIVATIONS} spells activated (${spellActs}).`,
      severity: "warning",
      section: "spells",
    });
  }
  return out;
}

export function checkAttributeBounds(held: HeldModel): Konflikt[] {
  const out: Konflikt[] = [];
  for (const a of held.attributes) {
    const total = a.base + a.purchased;
    if (a.code === "SO") {
      if (total < 1 || total > 13) {
        out.push({
          code: "so_bounds",
          message: `Social Standing must be between 1 and 13 (currently ${total}).`,
          severity: "error",
          section: "attributes",
        });
      }
      continue;
    }
    if (a.base < 8 || a.base > 14) {
      out.push({
        code: "attr_base_bounds",
        message: `${a.code} creation base must be between 8 and 14 (currently ${a.base}).`,
        severity: "error",
        section: "attributes",
      });
    }
    if (total > 20) {
      out.push({
        code: "attr_max",
        message: `${a.code} exceeds maximum 20 (currently ${total}).`,
        severity: "warning",
        section: "attributes",
      });
    }
  }
  return out;
}

export type BausteinAttrSource = {
  id?: string;
  name?: string;
  attribute_minimums?: Record<string, number>;
  so_min?: number;
  so_max?: number;
};

/**
 * Race / culture / profession attribute & SO mins/maxes — mirrors Java
 * `VoraussetzungMindeststufe` + `Eigenschaft.pruefeBausteinMindesstufe`.
 * Reports under both the baustein section and Attributes (like PanelProbleme).
 */
export function checkBausteinAttributeRequirements(
  held: HeldModel,
  sources: {
    race?: BausteinAttrSource | null;
    culture?: BausteinAttrSource | null;
    profession?: BausteinAttrSource | null;
  },
  attributeMods?: AttributeMods
): Konflikt[] {
  const out: Konflikt[] = [];
  const entries: {
    key: "race" | "culture" | "profession";
    section: KonfliktSection;
    source: BausteinAttrSource | null | undefined;
  }[] = [
    { key: "race", section: "race", source: sources.race },
    { key: "culture", section: "culture", source: sources.culture },
    { key: "profession", section: "profession", source: sources.profession },
  ];

  for (const { section, source } of entries) {
    if (!source) continue;
    const label =
      (source.name as string) ||
      String(source.id || "").replace(/^.*\./, "") ||
      section;
    const mins = source.attribute_minimums || {};
    for (const [code, need] of Object.entries(mins)) {
      const have = currentAttrValue(
        held,
        code as AttrCodeWithSo,
        attributeMods
      );
      if (have < Number(need)) {
        const attrLabel =
          ATTR_LABELS[code as AttrCodeWithSo] || code;
        // Profession / Race / Culture section (short form)
        out.push({
          code: `baustein_min:${section}:${code}`,
          message: `${label}: ${code} ≥ ${need}`,
          severity: "error",
          section,
        });
        // Attributes section (named baustein form — Java HeldenbausteinMindeststufe)
        out.push({
          code: `attr_baustein_min:${section}:${code}`,
          message: `${attrLabel}: ${label} requires ${code} ≥ ${need}`,
          severity: "error",
          section: "attributes",
        });
      }
    }

    const so = currentAttrValue(held, "SO", attributeMods);
    const soMin = Number(source.so_min ?? 0);
    const soMax = source.so_max != null ? Number(source.so_max) : null;
    if (soMin > 0 && so < soMin) {
      out.push({
        code: `baustein_so_min:${section}`,
        message: `${label}: SO ≥ ${soMin}`,
        severity: "error",
        section,
      });
      out.push({
        code: `attr_baustein_so_min:${section}`,
        message: `Social Standing: ${label} requires SO ≥ ${soMin}`,
        severity: "error",
        section: "attributes",
      });
    }
    if (soMax != null && so > soMax) {
      out.push({
        code: `baustein_so_max:${section}`,
        message: `${label}: SO ≤ ${soMax}`,
        severity: "error",
        section,
      });
      out.push({
        code: `attr_baustein_so_max:${section}`,
        message: `Social Standing: ${label} requires SO ≤ ${soMax}`,
        severity: "error",
        section: "attributes",
      });
    }
  }
  return out;
}

export function checkRaceCultureProfession(
  held: HeldModel,
  race?: { allowed_cultures?: string[] } | null,
  culture?: {
    professions?: {
      mode?: string;
      exclude?: string[];
      include?: string[];
    };
  } | null
): Konflikt[] {
  const out: Konflikt[] = [];
  if (!held.raceId) {
    out.push({
      code: "missing_race",
      message: "No race selected.",
      severity: "error",
      section: "race",
    });
  }
  if (!held.cultureId) {
    out.push({
      code: "missing_culture",
      message: "No culture selected.",
      severity: "error",
      section: "culture",
    });
  }
  if (!held.professionId) {
    out.push({
      code: "missing_profession",
      message: "No profession selected.",
      severity: "error",
      section: "profession",
    });
  }
  if (
    held.cultureId &&
    !isCultureAllowedForRace(race, held.cultureId)
  ) {
    out.push({
      code: "culture_not_allowed",
      message:
        "According to the rules this culture cannot be combined with the selected race.",
      severity: "error",
      section: "culture",
    });
  }
  if (
    held.professionId &&
    culture?.professions &&
    !isProfessionAllowedForCulture(culture, held.professionId)
  ) {
    const p = culture.professions;
    out.push({
      code:
        p.mode === "all_except"
          ? "profession_excluded"
          : "profession_not_allowed",
      message:
        "According to the rules this profession cannot be combined with the selected culture.",
      severity: "error",
      section: "profession",
    });
  }
  return out;
}
