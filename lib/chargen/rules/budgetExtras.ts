/**
 * Extended budget calculations — Educated AP, magic AP sub-budget, SF GP payment.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel } from "@/lib/chargen/types";
import { apToRaise } from "@/lib/chargen/rules/kosten";
import { resolveSpellSktColumn, resolveTalentSktColumn, baseTalentSktColumn } from "@/lib/chargen/rules/sktColumn";
import { countNonSeededActivations } from "@/lib/chargen/rules/talentActivation";
import { specializationApCost, type ExpandedSpecialAbility } from "@/lib/chargen/rules/expandSpecialAbilities";

const EDUCATED_ID = "VorNachteil.Gebildet";
const AP_PER_EDUCATED_STAGE = 40;

const MAGICAL_SF_IDS = new Set([
  "Sonderfertigkeit.Repraesentation",
  "Sonderfertigkeit.AstraleMeditation",
  "Sonderfertigkeit.GrosseMeditation",
  "Sonderfertigkeit.BindungDesStabes",
  "Sonderfertigkeit.Kraftfokus",
  "Sonderfertigkeit.SeilDesAdepten",
  "Sonderfertigkeit.EwigeFlamme",
  "Sonderfertigkeit.Salasandra",
  "Sonderfertigkeit.UnauerSchule",
]);

export function educatedApSavings(held: HeldModel): number {
  const gebildet = held.advantagesDisadvantages.find(
    (t) => t.id === EDUCATED_ID
  );
  if (!gebildet) return 0;
  const stage = gebildet.rating ?? 1;
  return stage * AP_PER_EDUCATED_STAGE;
}

export function specialAbilityGpSpent(held: HeldModel): number {
  let sum = 0;
  for (const sa of held.specialAbilities) {
    if (sa.payment === "gp") sum += 1;
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
      sum += 1;
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
