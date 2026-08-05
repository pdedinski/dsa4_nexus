/**
 * Human-readable labels for Java Chargen Voraussetzung keys
 * (special abilities / advantages).
 */

import { ATTR_LABELS, type AttrCodeWithSo } from "@/lib/chargen/types";

const ATTR_FROM_KEY: Record<string, AttrCodeWithSo> = {
  MU: "CO",
  KL: "CL",
  IN: "IN",
  CH: "CH",
  FF: "DE",
  GE: "AG",
  KO: "CN",
  KK: "ST",
  SO: "SO",
};

/** Fixed keys → English (from Lokalisierung_en Voraussetzung* where applicable). */
const FIXED_LABELS: Record<string, string> = {
  NICHT_BEGINN: "Cannot be selected at character creation",
  NICHT_FREI_WAEHLBAR: "Not freely selectable",
  NICHT_EINARMIG: "Not with One-Armed",
  NICHT_TOTENANGST: "Not with Fear of the Dead",
  NICHT_LINKHAND: "Not with Left-Handed Fighting",
  NICHT_SCHILDKAMPF_I: "Not with Shield Combat I",
  NICHT_SCHILDKAMPF_II: "Not with Shield Combat II",
  NICHT_ZWEIHAND_HIEBWAFFEN: "Not with Two-Handed Impact Weapons",
  NICHT_ZWEIHANDSCHWERTER: "Not with Two-Handed Swords",
  NICHT_ANATOMIE: "Not with Anatomy",
  NICHT_ELFEN: "Not for elves",
  NICHT_KAEMPFER: "Not for fighter professions",
  SPEZIALISIERUNG: "Requires a talent specialization",
  KULTURKUNDE: "Requires Area Knowledge (culture) TP ≥ 5",
  STUFEN: "Requires a valid rating/stage",
  STANDARD: "Standard requirements",
  TALENT: "Requires a talent selection",
  ZV: "Only for spellcasters (full / half / quarter)",
  Z: "Only for full spellcasters",
  V: "Only for quarter spellcasters",
  INITIATIVE_10: "INI ≥ 10",
  PARADE_8: "base PA ≥ 8",
};

const SF_FIELD_LABELS: Record<string, string> = {
  AUFMERKSAMKEIT: "Attention",
  AUSWEICHEN_I: "Dodge I",
  AUSWEICHEN_II: "Dodge II",
  FINTE: "Feint",
  KAMPFREFLEXE: "Combat Reflexes",
  LINKHAND: "Left-Handed Fighting",
  MEISTERPARADE: "Masterful Parry",
  REGENERATION_I: "Regeneration I",
  RUESTUNGSGEWOEHNUNG_I: "Armor Familiarity I",
  SCHILDKAMPF_I: "Shield Combat I",
  WUCHTSCHLAG: "Mighty Blow",
};

const TALENT_FIELD_LABELS: Record<string, string> = {
  FAHRZEUGE_LENKEN: "Drive Cart/Wagon",
  FAHRZEUG_LENKEN: "Drive Cart/Wagon",
  KOERPERBEHERRSCHUNG: "Body Control",
  RAUFEN: "Brawling",
  REITEN: "Riding",
  RINGEN: "Wrestling",
  RITUALKENNTNIS: "Ritual Lore",
};

function titleCaseWords(s: string): string {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Format a single Voraussetzung key for UI display.
 */
export function formatPrerequisite(
  key: string,
  resolveName?: (id: string) => string | undefined
): string {
  if (!key) return "";
  if (FIXED_LABELS[key]) return FIXED_LABELS[key];

  const attr = /^([A-Z]{2})_(\d+)$/.exec(key);
  if (attr && ATTR_FROM_KEY[attr[1]]) {
    const code = ATTR_FROM_KEY[attr[1]];
    return `${code} (${ATTR_LABELS[code]}) ≥ ${attr[2]}`;
  }

  if (SF_FIELD_LABELS[key]) {
    return `Requires ${SF_FIELD_LABELS[key]}`;
  }

  const talentNum = /^([A-Z_]+)_(\d+)$/.exec(key);
  if (talentNum) {
    const field = talentNum[1];
    const n = talentNum[2];
    if (ATTR_FROM_KEY[field]) {
      const code = ATTR_FROM_KEY[field];
      return `${code} (${ATTR_LABELS[code]}) ≥ ${n}`;
    }
    const label =
      TALENT_FIELD_LABELS[field] ||
      resolveName?.(`Talent.${titleCaseWords(field).replace(/\s/g, "")}`) ||
      titleCaseWords(field);
    return `${label} TP ≥ ${n}`;
  }

  return titleCaseWords(key);
}

export function formatPrerequisites(
  keys: string[] | undefined | null,
  resolveName?: (id: string) => string | undefined
): string {
  if (!keys?.length) return "";
  return keys.map((k) => formatPrerequisite(k, resolveName)).join("; ");
}

/** True if this ability/trait cannot be freely chosen during creation. */
export function blocksCreationChoice(keys: string[] | undefined | null): boolean {
  if (!keys?.length) return false;
  return keys.some(
    (k) => k === "NICHT_BEGINN" || k === "NICHT_FREI_WAEHLBAR"
  );
}
