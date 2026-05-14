import artisanTalents from "@/data/talents/artisan_talents.json";
import combatTalents from "@/data/talents/combat_talents.json";
import languagesTalents from "@/data/talents/languages_scripts.json";
import loreTalents from "@/data/talents/lore_talents.json";
import natureTalents from "@/data/talents/nature_talents.json";
import physicalTalents from "@/data/talents/physical_talents.json";
import socialTalents from "@/data/talents/social_talents.json";

export type TalentDef = {
  id: string;
  name: string;
  advancement_column?: string;
  test_attributes?: string[];
  is_basic?: boolean;
  combat_type?: string | null;
  /** Effective encumbrance class (EEC / effective EC interaction), when present in JSON. */
  eec?: string | null;
};

const TALENT_FILES: { group: string; data: { talents: TalentDef[] } }[] = [
  { group: "combat_talents", data: combatTalents },
  { group: "physical_talents", data: physicalTalents },
  { group: "social_talents", data: socialTalents },
  { group: "nature_talents", data: natureTalents },
  { group: "lore_talents", data: loreTalents },
  { group: "artisan_talents", data: artisanTalents },
  { group: "languages_scripts", data: languagesTalents },
];

function buildTalentIndex(): Map<string, TalentDef & { group: string }> {
  const map = new Map<string, TalentDef & { group: string }>();
  for (const { group, data } of TALENT_FILES) {
    for (const t of data.talents) {
      map.set(t.id, { ...t, group });
    }
  }
  return map;
}

/** Single index for generator + server APIs (do not import in client components — bundle size). */
export const TALENT_INDEX = buildTalentIndex();

/** Stable list for TGP iteration (order not guaranteed). */
export const ALL_TALENT_IDS: readonly string[] = Array.from(TALENT_INDEX.keys());

/** Codex `eec` field for talent tests / encumbrance (not all groups define it). */
export function getTalentEec(talentId: string): string | undefined {
  const t = TALENT_INDEX.get(talentId);
  const e = t?.eec;
  return e == null || e === "" ? undefined : e;
}

export function getTalentCodexLocation(
  talentId: string
): { category: "talents"; fileKey: string } | null {
  const t = TALENT_INDEX.get(talentId);
  if (!t) return null;
  return { category: "talents", fileKey: t.group };
}
