/**
 * Prerequisite / conflict checks — mirrors Java `Voraussetzung` packages (simplified).
 */

import type { HeldModel } from "@/lib/chargen/types";
import { currentAttrValue, talentTp } from "@/lib/chargen/types";
import { hasSpecialAbility, hasTrait } from "@/lib/chargen/rules/kosten";
import { countNonSeededActivations } from "@/lib/chargen/rules/talentActivation";

export interface Konflikt {
  code: string;
  message: string;
  severity: "error" | "warning";
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
    });
  }
  if (hasBegGruppe && hasUnfGruppe) {
    out.push({
      code: "begabung_unfaehigkeit_gruppe",
      message:
        "Gifted (Talent Group) and Ineptitude (Talent Group) cannot both be active.",
      severity: "error",
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
      });
    }
  }
  return out;
}

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
    const cultureKey = variant.replace(/^Kulturkunde\./, "").replace(
      /^Kultur\./,
      ""
    );
    let relatedLang: string | undefined;
    if (cultureKey) {
      relatedLang = `Talent.${cultureKey.split(".").pop() || ""}`;
    }
    const langs = held.talents.filter(
      (t) =>
        t.id.startsWith("Talent.") &&
        !t.id.includes("Schrift") &&
        (relatedLang ? t.id === relatedLang : true)
    );
    const ok = langs.some((t) => talentTp(held, t.id) >= 5);
    if (!ok) {
      const variantLabel =
        resolveName?.(variant) ||
        variant.replace(/^Kulturkunde\./, "") ||
        "variant";
      out.push({
        code: "kulturkunde_language",
        message: `Culture Lore (${variantLabel}) requires a related language at TP ≥ 5.`,
        severity: "warning",
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
    });
  }
  if (negGp > MAX_GP_NEGATIVE_ATTRS) {
    out.push({
      code: "gp_negative_attrs_cap",
      message: `More than ${MAX_GP_NEGATIVE_ATTRS} GP from negative attributes (${negGp}).`,
      severity: "warning",
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
        });
      }
      continue;
    }
    if (a.base < 8 || a.base > 14) {
      out.push({
        code: "attr_base_bounds",
        message: `${a.code} creation base must be between 8 and 14 (currently ${a.base}).`,
        severity: "error",
      });
    }
    if (total > 20) {
      out.push({
        code: "attr_max",
        message: `${a.code} exceeds maximum 20 (currently ${total}).`,
        severity: "warning",
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
    });
  }
  if (!held.cultureId) {
    out.push({
      code: "missing_culture",
      message: "No culture selected.",
      severity: "error",
    });
  }
  if (!held.professionId) {
    out.push({
      code: "missing_profession",
      message: "No profession selected.",
      severity: "error",
    });
  }
  if (
    race?.allowed_cultures?.length &&
    held.cultureId &&
    !race.allowed_cultures.includes(held.cultureId)
  ) {
    out.push({
      code: "culture_not_allowed",
      message: "Selected culture is not allowed for this race.",
      severity: "error",
    });
  }
  if (culture?.professions && held.professionId) {
    const p = culture.professions;
    if (p.mode === "all_except" && p.exclude?.includes(held.professionId)) {
      out.push({
        code: "profession_excluded",
        message: "Selected profession is excluded by this culture.",
        severity: "error",
      });
    }
    if (
      (p.mode === "list" || p.mode === "none_except") &&
      p.include?.length &&
      !p.include.includes(held.professionId)
    ) {
      out.push({
        code: "profession_not_allowed",
        message: "Selected profession is not allowed for this culture.",
        severity: "error",
      });
    }
  }
  return out;
}
