/**
 * Talent-group variants for Aptitude / Inaptitude (Java VariantenTalentgruppe).
 * XML stores Talentgruppe.* / VariantenTalentgruppe.* IDs; the wizard and SKT
 * logic use English group keys (nature, combat, …).
 */

const JAVA_TO_INTERNAL: Record<string, string> = {
  "Talentgruppe.Kampf": "combat",
  "Talentgruppe.Koerper": "physical",
  "Talentgruppe.Gesellschaft": "social",
  "Talentgruppe.Natur": "nature",
  "Talentgruppe.Wissen": "knowledge",
  "Talentgruppe.Sprachen": "languages",
  "Talentgruppe.Schriften": "scripts",
  "Talentgruppe.Handwerk": "craft",
  "Talentgruppe.Gaben": "gifts",
  "Talentgruppe.Ritualkenntnis": "ritual_knowledge",
  "VariantenTalentgruppe.Nahkampffertigkeiten": "nahkampf",
  "VariantenTalentgruppe.Fernkampffertigkeiten": "fernkampf",
};

const INTERNAL_TO_JAVA: Record<string, string> = Object.fromEntries(
  Object.entries(JAVA_TO_INTERNAL).map(([javaId, internal]) => [
    internal,
    javaId,
  ])
);

/** English labels matching Java Lokalisierung_en Talentgruppe / VariantenTalentgruppe. */
export const TALENT_GROUP_VARIANT_LABELS: Record<string, string> = {
  combat: "Combat Talents",
  nahkampf: "Armed Melee Talents",
  fernkampf: "Ranged Combat Talents",
  physical: "Physical Talents",
  social: "Social Talents",
  nature: "Nature Talents",
  knowledge: "Lore Talents",
  languages: "Languages",
  scripts: "Scripts",
  craft: "Artisan Talents",
  gifts: "Gift Talents",
  ritual_knowledge: "Ritual Lore",
};

const GROUP_TRAIT_IDS = new Set([
  "VorNachteil.BegabungFuerTalentgruppe",
  "VorNachteil.UnfaehigkeitFuerTalentgruppe",
]);

export function isTalentGroupTrait(traitId: string): boolean {
  return GROUP_TRAIT_IDS.has(traitId);
}

/** Map a Java or internal group id to the English group key used in-app. */
export function canonicalTalentGroupVariant(raw: string | null | undefined): string {
  if (!raw) return "";
  const id = String(raw).replace(/\.Name$/, "");
  return JAVA_TO_INTERNAL[id] || id;
}

/** Map an in-app group key back to the Java Variante id for .dcg export. */
export function javaTalentGroupVariant(raw: string | null | undefined): string {
  if (!raw) return "";
  const canonical = canonicalTalentGroupVariant(raw);
  return INTERNAL_TO_JAVA[canonical] || String(raw);
}

export function talentGroupVariantLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const canonical = canonicalTalentGroupVariant(raw);
  return TALENT_GROUP_VARIANT_LABELS[canonical] || null;
}

export function talentGroupVariantOptions(): { id: string; label: string }[] {
  return Object.entries(TALENT_GROUP_VARIANT_LABELS)
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function talentGroupVariantAliases(): Record<string, string> {
  const out: Record<string, string> = { ...TALENT_GROUP_VARIANT_LABELS };
  for (const [javaId, internal] of Object.entries(JAVA_TO_INTERNAL)) {
    const label = TALENT_GROUP_VARIANT_LABELS[internal];
    if (label) out[javaId] = label;
  }
  return out;
}

/** Rewrite Java Talentgruppe.* variants to in-app group keys. */
export function canonicalizeHeldTraitVariants<
  T extends {
    advantagesDisadvantages: Array<{ id: string; variant?: string }>;
  },
>(held: T): T {
  let changed = false;
  const next = held.advantagesDisadvantages.map((t) => {
    if (!t.variant || !isTalentGroupTrait(t.id)) return t;
    const canonical = canonicalTalentGroupVariant(t.variant);
    if (!canonical || canonical === t.variant) return t;
    changed = true;
    return { ...t, variant: canonical };
  });
  return changed ? { ...held, advantagesDisadvantages: next } : held;
}
