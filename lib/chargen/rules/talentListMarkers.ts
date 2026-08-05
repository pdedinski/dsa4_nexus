/**
 * Expand Java Chargen special talent-list markers (Fremdsprachen, etc.)
 * used in profession open bonus picks.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";

export const TALENT_LIST_MARKERS = {
  FREMDSPRACHEN: "Fremdsprachen",
  MUTTERSPRACHE: "Muttersprache",
  NICHT_MUTTERSPRACHE: "NichtMuttersprache",
  SCHRIFTEN_MUTTERSPRACHE: "SchriftenMuttersprache",
} as const;

export type TalentListMarker =
  (typeof TALENT_LIST_MARKERS)[keyof typeof TALENT_LIST_MARKERS];

const MARKER_SET = new Set<string>(Object.values(TALENT_LIST_MARKERS));

export function isTalentListMarker(id: string): id is TalentListMarker {
  return MARKER_SET.has(id);
}

/** Scripts associated with each language talent (Java Sprache.getSchriften). */
const LANGUAGE_SCRIPTS: Record<string, string[]> = {
  "Talent.Garethi": ["Talent.KuslikerZeichen"],
  "Talent.Tulamidya": ["Talent.TulamidyaSchrift"],
  "Talent.UrTulamidya": ["Talent.UrTulamidyaSchrift"],
  "Talent.Thorwalsch": ["Talent.HjaldingscheRunen"],
  "Talent.Rogolan": ["Talent.RogolanSchrift"],
  "Talent.Isdira": ["Talent.IsdiraSchrift"],
  "Talent.Asdharia": ["Talent.AsdhariaSchrift"],
  "Talent.Zhayad": ["Talent.ZhayadSchrift"],
  "Talent.Bosparano": ["Talent.UrTulamidyaSchrift"],
};

export function expandTalentListMarker(
  marker: string,
  catalog: CatalogItem[],
  opts: {
    motherTongue?: string;
    secondLanguage?: string;
  } = {}
): string[] {
  const mother = opts.motherTongue || "";
  const second = opts.secondLanguage || "";
  const languages = catalog
    .filter((t) => t.group === "languages" || t.language === true)
    .map((t) => String(t.id));

  switch (marker) {
    case TALENT_LIST_MARKERS.FREMDSPRACHEN:
      return languages.filter((id) => id !== mother && id !== second);
    case TALENT_LIST_MARKERS.MUTTERSPRACHE:
      return mother ? [mother] : [];
    case TALENT_LIST_MARKERS.NICHT_MUTTERSPRACHE:
      return ["Talent.Tulamidya", "Talent.Garethi"].filter((id) => id !== mother);
    case TALENT_LIST_MARKERS.SCHRIFTEN_MUTTERSPRACHE: {
      const scripts = mother ? LANGUAGE_SCRIPTS[mother] || [] : [];
      return scripts.filter((id) => catalog.some((t) => t.id === id));
    }
    default:
      return [];
  }
}

export function expandOpenTalentIds(
  talentIds: string[],
  catalog: CatalogItem[],
  opts: {
    motherTongue?: string;
    secondLanguage?: string;
  } = {}
): string[] {
  if (talentIds.length === 1 && isTalentListMarker(talentIds[0])) {
    return expandTalentListMarker(talentIds[0], catalog, opts);
  }
  return talentIds;
}

export function isExpandableOpenTalentBonus(entry: {
  type?: string;
  open?: boolean;
  talents?: string[];
}): boolean {
  const talents = entry.talents || [];
  if (entry.type !== "fixed") return false;
  if (entry.open || talents.length > 1) return true;
  return talents.length === 1 && isTalentListMarker(talents[0]);
}
