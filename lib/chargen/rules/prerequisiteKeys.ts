/**
 * Shared Voraussetzung key parsing for talents and special abilities.
 */

import type { AttrCodeWithSo } from "@/lib/chargen/types";

export const ATTR_FROM_KEY: Record<string, AttrCodeWithSo> = {
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

export const TALENT_KEY_ALIASES: Record<string, string> = {
  FAHRZEUGE_LENKEN: "Talent.FahrzeugLenken",
  FAHRZEUG_LENKEN: "Talent.FahrzeugLenken",
  KOERPERBEHERRSCHUNG: "Talent.Koerperbeherrschung",
  KOERPERBEHERSCHUNG: "Talent.Koerperbeherrschung",
  RAUFEN: "Talent.Raufen",
  REITEN: "Talent.Reiten",
  RINGEN: "Talent.Ringen",
  RITUALKENNTNIS: "Talent.Ritualkenntnis",
  MALEN_ZEICHNEN: "Talent.MalenZeichnen",
  GESTEINSKUNDE: "Talent.Gesteinskunde",
  HOLZBEARBEITUNG: "Talent.Holzbearbeitung",
  MENSCHENKENNTNIS: "Talent.Menschenkenntnis",
  SINNENSCHAERFE: "Talent.Sinnenschaerfe",
  TIERKUNDE: "Talent.Tierkunde",
  WILDNISLEBEN: "Talent.Wildnisleben",
  RECHNEN: "Talent.Rechnen",
  GARETHI: "Talent.Garethi",
  TULAMIDYA: "Talent.Tulamidya",
  KUSLIKER_ZEICHEN: "Talent.KuslikerZeichen",
  TULAMIDYA_SCHRIFT: "Talent.TulamidyaSchrift",
  UR_TULAMIDYA_SCHRIFT: "Talent.UrTulamidyaSchrift",
};

export const TRAIT_KEY_TO_ID: Record<string, string> = {
  EINARMIG: "VorNachteil.Einarmig",
  TOTENANGST: "VorNachteil.Totenangst",
  VIERTELZAUBERER: "VorNachteil.Viertelzauberer",
  VOLLZAUBERER: "VorNachteil.Vollzauberer",
  ZWEISTIMMIGER_GESANG: "VorNachteil.ZweistimmigerGesang",
};

/** AUSWEICHEN_II → Sonderfertigkeit.AusweichenII */
export function sfVoraussetzungKeyToId(key: string): string {
  const parts = key.split("_");
  let roman = "";
  const words: string[] = [];
  for (const p of parts) {
    if (/^(I|II|III|IV|V)$/.test(p)) roman = p;
    else words.push(p.charAt(0) + p.slice(1).toLowerCase());
  }
  const base = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return `Sonderfertigkeit.${base}${roman}`;
}

export function talentVoraussetzungKeyToId(field: string): string {
  if (TALENT_KEY_ALIASES[field]) return TALENT_KEY_ALIASES[field];
  const parts = field.split("_");
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
  return `Talent.${pascal}`;
}

export function parseAttributePrerequisite(
  key: string
): { code: AttrCodeWithSo; need: number } | null {
  const attr = /^([A-Z]{2})_(\d+)$/.exec(key);
  if (!attr || !ATTR_FROM_KEY[attr[1]]) return null;
  return { code: ATTR_FROM_KEY[attr[1]], need: Number(attr[2]) };
}

export function parseTalentLevelPrerequisite(
  key: string
): { talentId: string; need: number; steigern: boolean } | null {
  const steigern = key.endsWith("_STEIGERN");
  const base = steigern ? key.slice(0, -"_STEIGERN".length) : key;
  const talentNum = /^([A-Z][A-Z_]*)_(\d+)$/.exec(base);
  if (!talentNum) return null;
  const field = talentNum[1];
  if (ATTR_FROM_KEY[field]) return null;
  return {
    talentId: talentVoraussetzungKeyToId(field),
    need: Number(talentNum[2]),
    steigern,
  };
}

/** Composite keys with OR semantics (any listed talent at level). */
export const OR_TALENT_PREREQ_KEYS: Record<
  string,
  { need: number; steigern: boolean; talentIds: string[] }
> = {
  GARETHI_TULAMIDYA_6_STEIGERN: {
    need: 6,
    steigern: true,
    talentIds: ["Talent.Garethi", "Talent.Tulamidya"],
  },
  KULTURSPRACHE_6_STEIGERN: {
    need: 6,
    steigern: true,
    talentIds: [
      "Talent.KuslikerZeichen",
      "Talent.TulamidyaSchrift",
      "Talent.UrTulamidyaSchrift",
    ],
  },
};
