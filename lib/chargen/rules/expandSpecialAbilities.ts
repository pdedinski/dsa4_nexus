/**
 * Expand Java Chargen special-ability templates into selectable instances
 * (Talent/Weapon Specialization per talent, Sharpshooter per ranged technique,
 * Quick Load with talent, variant pickers).
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import variantLabels from "@/lib/chargen/data/variant_labels.json";
import { sktFactor } from "@/lib/chargen/rules/kosten";
import type { HeldModel, SpecialAbilityWert } from "@/lib/chargen/types";

const LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  (variantLabels as Array<{ id: string; name?: string }>).map((v) => [
    v.id,
    v.name || v.id,
  ])
);

export const SF_GROUP_ORDER: { id: string; label: string }[] = [
  { id: "general", label: "General" },
  { id: "combat", label: "Combat" },
  { id: "magical", label: "Magical" },
  { id: "talent_specialization", label: "Talent Specialization" },
  { id: "weapon_specialization", label: "Weapon Specialization" },
];

export type VariantMode = "none" | "list" | "free_text";

export interface ExpandedSpecialAbility extends CatalogItem {
  instanceKey: string;
  displayName: string;
  talent?: string;
  variantMode: VariantMode;
  /** Preset variant option ids (localization keys). */
  variantOptions: { id: string; name: string }[];
  freeVariant: boolean;
  /** When true, row is an expansion template stub and should not appear alone. */
  isTemplate?: boolean;
}

function labelOf(id: string, fallback?: string): string {
  return LABEL_BY_ID[id] || fallback || id.replace(/^.*\./, "");
}

function variantOptionsFromIds(ids: string[]): { id: string; name: string }[] {
  return ids.map((id) => ({ id, name: labelOf(id) }));
}

function resolveVariantOptions(
  source: string | null | undefined,
  talents: CatalogItem[],
  armors: CatalogItem[],
  talentSpecs?: string[]
): { mode: VariantMode; options: { id: string; name: string }[]; free: boolean } {
  if (source === "kulturkunde") {
    return {
      mode: "list",
      options: (variantLabels as Array<{ id: string; name?: string }>)
        .filter((v) => v.id.startsWith("Kulturkunde."))
        .map((v) => ({ id: v.id, name: v.name || v.id })),
      free: false,
    };
  }
  if (source === "representation") {
    return {
      mode: "list",
      options: (variantLabels as Array<{ id: string; name?: string }>)
        .filter((v) => v.id.startsWith("Repraesentation."))
        .map((v) => ({ id: v.id, name: v.name || v.id })),
      free: false,
    };
  }
  if (source === "armor") {
    return {
      mode: "list",
      options: armors.map((a) => ({
        id: a.id,
        name: (a.name as string) || a.id,
      })),
      free: false,
    };
  }
  if (source === "free_text") {
    return { mode: "free_text", options: [], free: true };
  }
  if (talentSpecs && talentSpecs.length) {
    return {
      mode: "list",
      options: variantOptionsFromIds(talentSpecs),
      free: true,
    };
  }
  if (talentSpecs) {
    return { mode: "free_text", options: [], free: true };
  }
  void talents;
  return { mode: "none", options: [], free: false };
}

/**
 * Build the selectable SA catalog mirroring Java PanelSonderfertigkeiten tabs.
 */
export function expandSpecialAbilities(
  specials: CatalogItem[],
  talents: CatalogItem[],
  armors: CatalogItem[] = []
): ExpandedSpecialAbility[] {
  const out: ExpandedSpecialAbility[] = [];
  const templates = new Map<string, CatalogItem>();

  for (const s of specials) {
    const expand = s.expand_template as string | null | undefined;
    if (expand) {
      templates.set(String(expand), s);
      continue;
    }

    const talentId = (s.talent as string) || undefined;
    const talent = talentId
      ? talents.find((t) => t.id === talentId)
      : undefined;
    const baseName = (s.name as string) || s.id;
    const displayName = talent
      ? `${baseName} (${(talent.name as string) || talentId})`
      : baseName;

    const { mode, options, free } = resolveVariantOptions(
      s.variant_source as string | undefined,
      talents,
      armors
    );

    out.push({
      ...s,
      instanceKey: talentId ? `${s.id}|${talentId}` : s.id,
      displayName,
      talent: talentId,
      variantMode: mode,
      variantOptions: options,
      freeVariant: free || Boolean(s.free_variant),
    });
  }

  const talentSpecTpl = templates.get("talent_specialization");
  if (talentSpecTpl) {
    for (const t of talents) {
      const group = String(t.group || "");
      if (
        group === "combat" ||
        group === "languages" ||
        group === "scripts" ||
        group === "ritual_knowledge"
      ) {
        continue;
      }
      const specs = (t.specializations as string[]) || [];
      const { mode, options, free } = resolveVariantOptions(
        null,
        talents,
        armors,
        specs
      );
      out.push({
        ...talentSpecTpl,
        group: "talent_specialization",
        group_raw: "TALENTSPEZIALISIERUNG",
        prerequisites: ["SPEZIALISIERUNG"],
        kosten_key: "TALENTSPEZIALISIERUNG",
        ap_cost: null,
        instanceKey: `Sonderfertigkeit.Talentspezialisierung|${t.id}`,
        displayName: `Talent Specialization (${(t.name as string) || t.id})`,
        talent: t.id,
        variantMode: mode,
        variantOptions: options,
        freeVariant: free,
        skt_column: t.skt_column ?? null,
      });
    }
  }

  const weaponSpecTpl = templates.get("weapon_specialization");
  if (weaponSpecTpl) {
    for (const t of talents) {
      if (String(t.group) !== "combat") continue;
      if (t.id === "Talent.Ringen") continue;
      const specs = (t.specializations as string[]) || [];
      const { mode, options, free } = resolveVariantOptions(
        null,
        talents,
        armors,
        specs
      );
      out.push({
        ...weaponSpecTpl,
        group: "weapon_specialization",
        group_raw: "WAFFENSPEZIALISIERUNG",
        prerequisites: ["SPEZIALISIERUNG"],
        kosten_key: "WAFFENSPEZIALISIERUNG",
        ap_cost: null,
        instanceKey: `Sonderfertigkeit.Waffenspezialisierung|${t.id}`,
        displayName: `Weapon Specialization (${(t.name as string) || t.id})`,
        talent: t.id,
        variantMode: mode,
        variantOptions: options,
        freeVariant: free,
        skt_column: t.skt_column ?? null,
      });
    }
  }

  const sharpTpl = templates.get("sharpshooter");
  if (sharpTpl) {
    for (const t of talents) {
      if (!t.combat || !t.ranged) continue;
      out.push({
        ...sharpTpl,
        group: "combat",
        group_raw: "KAMPF",
        prerequisites: ["SPEZIALISIERUNG"],
        ap_cost: sharpTpl.ap_cost ?? 300,
        instanceKey: `Sonderfertigkeit.Scharfschuetze|${t.id}`,
        displayName: `Sharpshooter (${(t.name as string) || t.id})`,
        talent: t.id,
        variantMode: "none",
        variantOptions: [],
        freeVariant: false,
      });
    }
  }

  return out;
}

export function saInstanceMatches(
  owned: SpecialAbilityWert,
  instance: { id: string; talent?: string },
  variant?: string | null
): boolean {
  if (owned.id !== instance.id) return false;
  if ((owned.talent || "") !== (instance.talent || "")) return false;
  if (variant != null) {
    return (owned.variant || "") === (variant || "");
  }
  return true;
}

export function findOwnedForInstance(
  held: HeldModel,
  instance: { id: string; talent?: string },
  variant?: string | null
): SpecialAbilityWert | undefined {
  return held.specialAbilities.find((o) =>
    saInstanceMatches(o, instance, variant)
  );
}

/** Index of this SF+talent (+variant) among owned copies (1-based), or next index. */
export function specializationIndex(
  held: HeldModel,
  id: string,
  talent: string | undefined,
  variant?: string | null
): number {
  const siblings = held.specialAbilities.filter(
    (s) => s.id === id && (s.talent || "") === (talent || "")
  );
  if (variant != null) {
    const idx = siblings.findIndex((s) => (s.variant || "") === (variant || ""));
    if (idx >= 0) return idx + 1;
  }
  return siblings.length + 1;
}

export function specializationApCost(
  held: HeldModel,
  instance: ExpandedSpecialAbility,
  variant?: string | null
): number {
  const key = String(instance.kosten_key || "");
  if (
    key === "TALENTSPEZIALISIERUNG" ||
    key === "WAFFENSPEZIALISIERUNG" ||
    instance.group === "talent_specialization" ||
    instance.group === "weapon_specialization"
  ) {
    const col =
      typeof instance.skt_column === "number"
        ? (instance.skt_column as number)
        : 2;
    const factor = sktFactor(col);
    const index = specializationIndex(
      held,
      instance.id,
      instance.talent,
      variant
    );
    return Math.round(factor * 20 * index);
  }
  const ap = instance.ap_cost != null ? Number(instance.ap_cost) : 0;
  return Number.isFinite(ap) ? ap : 0;
}

export function formatSpecialAbilityLabel(
  owned: SpecialAbilityWert,
  resolveName: (id: string) => string | undefined
): string {
  const base = resolveName(owned.id) || owned.id;
  const talent = owned.talent
    ? resolveName(owned.talent) || owned.talent
    : null;
  const variant = owned.variant
    ? labelOf(owned.variant, resolveName(owned.variant))
    : null;
  const parts = [base];
  if (talent) parts.push(`(${talent})`);
  if (variant) parts.push(`— ${variant}`);
  return parts.join(" ");
}

export function groupExpandedSpecialAbilities(
  items: ExpandedSpecialAbility[]
): { id: string; label: string; items: ExpandedSpecialAbility[] }[] {
  const order = SF_GROUP_ORDER.map((g) => g.id);
  const byGroup = new Map<string, ExpandedSpecialAbility[]>();
  for (const item of items) {
    const g = String(item.group || "general");
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(item);
  }
  for (const list of byGroup.values()) {
    list.sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: "base",
      })
    );
  }
  const groups = [
    ...order
      .filter((id) => byGroup.has(id))
      .map((id) => ({
        id,
        label: SF_GROUP_ORDER.find((g) => g.id === id)!.label,
        items: byGroup.get(id)!,
      })),
    ...[...byGroup.keys()]
      .filter((id) => !order.includes(id))
      .sort()
      .map((id) => ({
        id,
        label: id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        items: byGroup.get(id)!,
      })),
  ];
  return groups;
}
