/**
 * Human-readable labels for advantages / disadvantages in the chargen UI.
 * GP formulas mirror Java `vornachteile/kosten/Kosten*.java`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { HeldModel } from "@/lib/chargen/types";
import { attrValue } from "@/lib/chargen/types";
import { hasTrait } from "@/lib/chargen/rules/kosten";

export type TraitCatalogFields = {
  id?: string;
  kind?: string | null;
  gp_cost?: number | null;
  gp_per_level?: number | null;
  rating_min?: number | null;
  rating_max?: number | null;
  kosten_key?: string | null;
  cost_label?: string | null;
};

/** Context for held-dependent Kosten strategies. */
export type TraitGpContext = {
  held?: HeldModel;
  /** Talent catalog — needed for Begabung/Unfähigkeit talent-group lookup. */
  talents?: CatalogItem[];
  /** Trait variant (talent id, talent group id, or special-item id). */
  variant?: string | null;
  /**
   * When set, Connections GP is computed on (rating − grantedRating) only
   * (Java KostenVerbindungen).
   */
  grantedRating?: number | null;
};

/** Physical talents that use the cheaper Begabung/Unfähigkeit tier. */
const PHYSICAL_CHEAP_TALENTS = new Set([
  "Talent.Schwimmen",
  "Talent.SichVerstecken",
  "Talent.Singen",
  "Talent.Tanzen",
  "Talent.Zechen",
]);

/** Special Kosten strategies that are not a flat GP_* token. */
const SPECIAL_COST_LABELS: Record<string, string> = {
  GUTES_GEDAECHTNIS: "7 GP (12 GP for elves or mages)",
  HERAUSRAGENDE_BALANCE: "20 GP",
  HERAUSRAGENDE_EIGENSCHAFT: "GP = level × (level + 7)",
  BALANCE: "10 GP",
  BEGABUNG_TALENT: "4–6 GP (by talent group)",
  BEGABUNG_TALENTGRUPPE: "varies by talent group",
  BESONDERER_BESITZ: "7 GP (3 GP if noble)",
  ALBINO: "−7 GP (+1 GP per SO above 7)",
  ASTRALER_BLOCK: "−10 GP (−5 GP for quarter-casters)",
  IMMUNITAET_GIFT: "5 GP (less if Poison Resistance taken)",
  IMMUNITAET_GIFTART: "10 GP (less if Poison-type Resistance taken)",
  MEISTERHANDWERK: "5 GP (1 GP for quarter-casters)",
  UNFAEHIGKEIT_TALENT: "grants 1–2 GP (by talent group)",
  UNFAEHIGKEIT_TALENTGRUPPE: "grants 5–15 GP (by talent group)",
  VERBINDUNGEN: "1 GP per 3 levels (per 5 with Social Adaptability)",
};

export function formatTraitKind(kind: string | null | undefined): string | null {
  switch (kind) {
    case "advantage":
      return "Advantage";
    case "disadvantage":
      return "Disadvantage";
    case "negative_trait":
      return "Negative trait";
    default:
      return null;
  }
}

export function formatTraitCost(t: TraitCatalogFields): string | null {
  if (t.cost_label) return String(t.cost_label);

  if (t.gp_cost != null && Number.isFinite(Number(t.gp_cost))) {
    const n = Number(t.gp_cost);
    if (n < 0) return `grants ${-n} GP`;
    return `${n} GP`;
  }

  if (t.gp_per_level != null && Number.isFinite(Number(t.gp_per_level))) {
    const n = Number(t.gp_per_level);
    if (n === 1) return "1 GP per level";
    if (n === -1) return "grants 1 GP per level";
    if (n === 2) return "2 GP per level";
    if (n === -2) return "grants 2 GP per level";
    if (n === 0.5) return "1 GP per 2 levels";
    if (n === -0.5) return "grants 1 GP per 2 levels";
    if (n === -1.5) return "grants 3 GP per 2 levels";
    if (n > 0) return `${n} GP per level`;
    if (n < 0) return `grants ${-n} GP per level`;
  }

  const key = t.kosten_key ? String(t.kosten_key) : "";
  if (key && SPECIAL_COST_LABELS[key]) return SPECIAL_COST_LABELS[key];

  // Never dump raw German keys into the UI
  return null;
}

export function formatTraitRating(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  if (min == null && (max == null || max >= 99)) return null;
  if (min != null && (max == null || max >= 99)) {
    return `level ${min}+`;
  }
  if (min != null && max != null && min === max) {
    return `level ${min}`;
  }
  if (min != null && max != null) {
    return `level ${min}–${max}`;
  }
  if (max != null && max < 99) {
    return `up to level ${max}`;
  }
  return null;
}

export function formatTraitMeta(
  t: TraitCatalogFields,
  opts: { unsuitable?: boolean } = {}
): string {
  return [
    formatTraitKind(t.kind),
    formatTraitCost(t),
    formatTraitRating(
      t.rating_min != null ? Number(t.rating_min) : null,
      t.rating_max != null ? Number(t.rating_max) : null
    ),
    opts.unsuitable
      ? "Not suitable for this race/culture/profession"
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function isKampfKoerperExpensiveTalent(
  talents: CatalogItem[] | undefined,
  talentId: string | null | undefined
): boolean {
  if (!talentId || !talents) return false;
  const meta = talents.find((t) => t.id === talentId);
  if (!meta) return false;
  const group = String(meta.group || "");
  if (group === "combat") return true;
  if (group === "physical" && !PHYSICAL_CHEAP_TALENTS.has(talentId)) return true;
  return false;
}

function connectionsGp(
  levels: number,
  held?: HeldModel
): number {
  if (levels <= 0) return 0;
  const divisor = held && hasTrait(held, "VorNachteil.SozialeAnpassungsfaehigkeit")
    ? 5
    : 3;
  return Math.max(1, Math.round(levels / divisor));
}

function casterTierGp(
  held: HeldModel | undefined,
  fullCasterGp: number,
  quarterCasterGp: number
): number {
  if (held && hasTrait(held, "VorNachteil.Vollzauberer")) return fullCasterGp;
  return quarterCasterGp;
}

/**
 * Absolute GP cost for a trait at a given rating (Java getGpKosten without
 * vorgegeben credit). Callers subtract the granted baseline when needed.
 */
export function estimateTraitGp(
  t: TraitCatalogFields,
  rating?: number | null,
  ctx: TraitGpContext = {}
): number {
  const key = t.kosten_key ? String(t.kosten_key) : "";
  const r = rating ?? t.rating_min ?? 1;
  const held = ctx.held;
  const variant = ctx.variant ?? null;

  // Held-dependent strategies take priority over flat catalog gp_cost when a
  // kosten_key is present (catalog gp_cost is often a display default).
  switch (key) {
    case "GUTES_GEDAECHTNIS": {
      if (
        held &&
        (held.raceId === "Rasse.Elfen" || held.professionId === "Profession.Magier")
      ) {
        return 12;
      }
      return 7;
    }
    case "HERAUSRAGENDE_BALANCE":
      return 20;
    case "BALANCE":
      return 10;
    case "HERAUSRAGENDE_EIGENSCHAFT":
      return r * (r + 7);
    case "BESONDERER_BESITZ":
      return held && hasTrait(held, "VorNachteil.AdligeAbstammung") ? 3 : 7;
    case "BEGABUNG_TALENT":
      return isKampfKoerperExpensiveTalent(ctx.talents, variant) ? 6 : 4;
    case "BEGABUNG_TALENTGRUPPE": {
      const g = String(variant || "");
      if (g === "combat") return 30;
      if (g === "fernkampf") return 15;
      if (g === "nahkampf") return 20;
      return 20;
    }
    case "IMMUNITAET_GIFT":
      return 5;
    case "IMMUNITAET_GIFTART":
      return 10;
    case "MEISTERHANDWERK":
      return casterTierGp(held, 5, 1);
    case "ASTRALER_BLOCK":
      return casterTierGp(held, -10, -5);
    case "UNFAEHIGKEIT_TALENT":
      return isKampfKoerperExpensiveTalent(ctx.talents, variant) ? -2 : -1;
    case "UNFAEHIGKEIT_TALENTGRUPPE": {
      const g = String(variant || "");
      if (g === "combat" || g === "physical") return -15;
      if (g === "fernkampf") return -5;
      if (g === "languages" || g === "scripts") return -7;
      return -10;
    }
    case "VERBINDUNGEN": {
      // Absolute cost for `r` levels (not delta). Delta handled in traitGpNet.
      return connectionsGp(r, held);
    }
    case "ALBINO": {
      const so = held ? attrValue(held, "SO") : 1;
      return -7 + Math.max(0, so - 7);
    }
    case "IMMUNITAET_KRANKHEIT":
    case "IMMUNITAET_KRANKHEITEN":
      return 10;
    default:
      break;
  }

  if (t.gp_cost != null && Number.isFinite(Number(t.gp_cost))) {
    return Number(t.gp_cost);
  }
  if (t.gp_per_level != null && Number.isFinite(Number(t.gp_per_level))) {
    return Number(t.gp_per_level) * (rating ?? t.rating_min ?? 1);
  }
  return 0;
}

/**
 * GP charged for a trait after subtracting a granted baseline.
 * Connections use Java's delta-only formula.
 */
export function traitGpDelta(
  t: TraitCatalogFields,
  rating: number | null | undefined,
  grantedRating: number | null | undefined,
  ctx: TraitGpContext = {}
): number {
  const key = t.kosten_key ? String(t.kosten_key) : "";
  const current = rating ?? t.rating_min ?? 0;
  const granted = grantedRating ?? 0;

  if (key === "VERBINDUNGEN") {
    return connectionsGp(Math.max(0, current - granted), ctx.held);
  }

  if (granted > 0) {
    return (
      estimateTraitGp(t, current, ctx) - estimateTraitGp(t, granted, ctx)
    );
  }
  return estimateTraitGp(t, current, ctx);
}
