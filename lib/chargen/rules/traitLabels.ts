/**
 * Human-readable labels for advantages / disadvantages in the chargen UI.
 */

export type TraitCatalogFields = {
  kind?: string | null;
  gp_cost?: number | null;
  gp_per_level?: number | null;
  rating_min?: number | null;
  rating_max?: number | null;
  kosten_key?: string | null;
  cost_label?: string | null;
};

/** Special Kosten strategies that are not a flat GP_* token. */
const SPECIAL_COST_LABELS: Record<string, string> = {
  GUTES_GEDAECHTNIS: "7 GP (12 GP for elves or mages)",
  HERAUSRAGENDE_BALANCE: "20 GP",
  HERAUSRAGENDE_EIGENSCHAFT: "GP = level × (level + 7)",
  BALANCE: "10 GP",
  BEGABUNG_TALENT: "4–6 GP (by talent group)",
  BEGABUNG_TALENTGRUPPE: "varies by talent group",
  BESONDERER_BESITZ: "7 GP (3 GP if noble)",
  ALBINO: "special GP cost",
  ASTRALER_BLOCK: "−10 GP (−5 GP for half-casters)",
  IMMUNITAET_GIFT: "5 GP (less if Poison Resistance taken)",
  IMMUNITAET_GIFTART: "10 GP (less if Poison-type Resistance taken)",
  MEISTERHANDWERK: "5 GP (1 GP for spellcasters)",
  UNFAEHIGKEIT_TALENT: "grants 1–2 GP (by talent group)",
  UNFAEHIGKEIT_TALENTGRUPPE: "grants 5–15 GP (by talent group)",
  VERBINDUNGEN: "special GP cost (connections)",
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

/** GP used for budget when a special formula applies. */
export function estimateTraitGp(
  t: TraitCatalogFields,
  rating?: number | null
): number {
  if (t.gp_cost != null && Number.isFinite(Number(t.gp_cost))) {
    return Number(t.gp_cost);
  }
  if (t.gp_per_level != null && Number.isFinite(Number(t.gp_per_level))) {
    return Number(t.gp_per_level) * (rating ?? t.rating_min ?? 1);
  }
  const key = t.kosten_key ? String(t.kosten_key) : "";
  const r = rating ?? t.rating_min ?? 1;
  switch (key) {
    case "GUTES_GEDAECHTNIS":
      return 7;
    case "HERAUSRAGENDE_BALANCE":
      return 20;
    case "BALANCE":
      return 10;
    case "HERAUSRAGENDE_EIGENSCHAFT":
      return r * (r + 7);
    case "BESONDERER_BESITZ":
      return 7;
    case "BEGABUNG_TALENT":
      return 4;
    case "IMMUNITAET_GIFT":
      return 5;
    case "IMMUNITAET_GIFTART":
      return 10;
    case "MEISTERHANDWERK":
      return 5;
    case "ASTRALER_BLOCK":
      return -10;
    case "UNFAEHIGKEIT_TALENT":
      return -4;
    case "UNFAEHIGKEIT_TALENTGRUPPE":
      return -10;
    case "VERBINDUNGEN":
      return 0;
    case "ALBINO":
      return 15;
    case "IMMUNITAET_KRANKHEIT":
    case "IMMUNITAET_KRANKHEITEN":
      return 10;
    default:
      return 0;
  }
}
