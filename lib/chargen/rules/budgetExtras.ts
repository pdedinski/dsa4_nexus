/**
 * Extended budget calculations — Educated AP, magic AP sub-budget, SF GP payment.
 * Mirrors Java `ErschaffungManager` Gebildet / Magie / SF GP accounting.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel } from "@/lib/chargen/types";
import { activationCost, apToRaise } from "@/lib/chargen/rules/kosten";
import {
  resolveSpellSktColumn,
  resolveTalentSktColumn,
  baseTalentSktColumn,
} from "@/lib/chargen/rules/sktColumn";
import {
  countNonSeededActivations,
  talentRowApSpent,
} from "@/lib/chargen/rules/talentActivation";
import {
  specialAbilityGpCost,
  specializationApCost,
  type ExpandedSpecialAbility,
} from "@/lib/chargen/rules/expandSpecialAbilities";

const EDUCATED_ID = "VorNachteil.Gebildet";
const AP_PER_EDUCATED_STAGE = 40;
const NANDUS_ID = "Sonderfertigkeit.NandusgefaelligesWissen";

const EDUCATED_TALENT_GROUPS = new Set(["knowledge", "languages", "craft"]);

const MAGICAL_SF_IDS = new Set([
  "Sonderfertigkeit.Repraesentation",
  "Sonderfertigkeit.AstraleMeditation",
  "Sonderfertigkeit.GrosseMeditation",
  "Sonderfertigkeit.BindungDesStabes",
  "Sonderfertigkeit.Kraftfokus",
  "Sonderfertigkeit.SeilDesAdepten",
  "Sonderfertigkeit.EwigeFlamme",
  "Sonderfertigkeit.Salasandra",
]);

export function educatedApSavings(held: HeldModel): number {
  const gebildet = held.advantagesDisadvantages.find(
    (t) => t.id === EDUCATED_ID
  );
  if (!gebildet) return 0;
  const stage = gebildet.rating ?? 1;
  return stage * AP_PER_EDUCATED_STAGE;
}

function findExpandedForOwned(
  specials: ExpandedSpecialAbility[] | CatalogItem[],
  sa: { id: string; talent?: string; variant?: string }
): ExpandedSpecialAbility | CatalogItem | undefined {
  const expanded = specials as ExpandedSpecialAbility[];
  return (
    expanded.find(
      (s) =>
        s.id === sa.id &&
        ((s.talent as string) || "") === (sa.talent || "")
    ) ||
    specials.find((s) => s.id === sa.id)
  );
}

/**
 * GP spent on special abilities paid with GP during creation.
 * Specializations use the GP column table; others use round(AP/50).
 */
export function specialAbilityGpSpent(
  held: HeldModel,
  specials: ExpandedSpecialAbility[] | CatalogItem[] = []
): number {
  let sum = 0;
  for (const sa of held.specialAbilities) {
    if (sa.payment !== "gp") continue;
    const meta = findExpandedForOwned(specials, sa);
    if (!meta) {
      // Fallback when catalog not provided: 1 GP (legacy)
      sum += 1;
      continue;
    }
    sum += specialAbilityGpCost(
      held,
      meta as ExpandedSpecialAbility,
      sa.variant ?? null
    );
  }
  return sum;
}

export function talentSktColumn(
  held: HeldModel,
  talent: CatalogItem
): string;
export function talentSktColumn(talent: CatalogItem): string;
export function talentSktColumn(
  heldOrTalent: HeldModel | CatalogItem,
  maybeTalent?: CatalogItem
): string {
  if (maybeTalent) {
    return resolveTalentSktColumn(heldOrTalent as HeldModel, maybeTalent);
  }
  return baseTalentSktColumn(heldOrTalent as CatalogItem);
}

export function computeMagicApSpent(
  held: HeldModel,
  spells: CatalogItem[],
  specials: CatalogItem[]
): number {
  let sum = 0;
  for (const sp of held.spells) {
    const meta = spells.find((s) => s.id === sp.id);
    const col = resolveSpellSktColumn(
      held,
      meta ?? { id: sp.id, complexity: 2 }
    );
    if (sp.sp > 0) {
      sum += apToRaise(col, 0, sp.sp);
    } else if (sp.activated !== false) {
      sum += activationCost(held.phase, col);
    }
  }
  for (const sa of held.specialAbilities) {
    if (sa.payment === "gp") continue;
    const meta =
      specials.find(
        (s) =>
          s.id === sa.id && ((s.talent as string) || "") === (sa.talent || "")
      ) || specials.find((s) => s.id === sa.id);
    if (!meta) continue;
    const group = String(meta.group || "");
    if (group === "magical" || MAGICAL_SF_IDS.has(sa.id)) {
      const ap = specializationApCost(
        held,
        meta as ExpandedSpecialAbility,
        sa.variant ?? null
      );
      if (ap > 0) sum += ap;
    }
  }
  return sum;
}

/**
 * Java `ErschaffungManager.getApEinsparungGebildet` — how much of the
 * Educated pool is currently applied against eligible spend.
 */
export function educatedApApplied(
  held: HeldModel,
  talents: CatalogItem[],
  specials: CatalogItem[],
  spells: CatalogItem[],
  seededTalentIds: Set<string> = new Set()
): number {
  const pool = educatedApSavings(held);
  if (pool <= 0) return 0;

  let eligible = 0;
  for (const row of held.talents) {
    const meta = talents.find((t) => t.id === row.id);
    if (!meta) continue;
    if (!EDUCATED_TALENT_GROUPS.has(String(meta.group || ""))) continue;
    eligible += talentRowApSpent(row, held, meta, seededTalentIds);
  }

  for (const sa of held.specialAbilities) {
    if (sa.payment === "gp") continue;
    const meta = findExpandedForOwned(specials, sa);
    if (!meta) continue;
    const ap = specializationApCost(
      held,
      meta as ExpandedSpecialAbility,
      sa.variant ?? null
    );
    if (sa.id === NANDUS_ID) {
      eligible += ap;
      continue;
    }
    const key = String((meta as ExpandedSpecialAbility).kosten_key || "");
    const isSpec =
      key === "TALENTSPEZIALISIERUNG" ||
      key === "WAFFENSPEZIALISIERUNG" ||
      meta.group === "talent_specialization" ||
      meta.group === "weapon_specialization";
    if (!isSpec || !sa.talent) continue;
    const talentMeta = talents.find((t) => t.id === sa.talent);
    if (
      talentMeta &&
      EDUCATED_TALENT_GROUPS.has(String(talentMeta.group || ""))
    ) {
      eligible += ap;
    }
  }

  const magic = computeMagicApSpent(held, spells, specials);
  const magicShare = Math.min(magic, Math.floor((pool + 1) / 2));
  return Math.min(pool, eligible + magicShare);
}

export function countNonSeededTalentActivations(
  held: HeldModel,
  seededTalentIds: Set<string>
): number {
  return countNonSeededActivations(held, seededTalentIds);
}

export function countSpellActivations(held: HeldModel): number {
  return held.spells.filter((s) => s.sp > 0 || s.activated !== false).length;
}

export function gpFromDisadvantages(
  held: HeldModel,
  traits: CatalogItem[]
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

export function gpFromNegativeAttributes(
  held: HeldModel,
  traits: CatalogItem[]
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

export type { AttributeMods };
