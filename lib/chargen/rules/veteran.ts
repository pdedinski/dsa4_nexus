/**
 * Post-creation (Steigern / veteran) mode — mirrors Java `PanelSteigern` and related Held mutators.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import {
  specializationApCost,
  type ExpandedSpecialAbility,
  findOwnedForInstance,
} from "@/lib/chargen/rules/expandSpecialAbilities";
import { computeApStart } from "@/lib/chargen/rules/budget";
import {
  ATTR_COLUMN,
  shiftColumn,
  sktCost,
} from "@/lib/chargen/rules/kosten";
import type {
  AttrCodeWithSo,
  AttributeMods,
  DerivedCode,
  HeldModel,
  LearningMethod,
  SpecialAbilityWert,
} from "@/lib/chargen/types";
import {
  attrValue,
  currentAttrValue,
  LEARNING_METHOD_COLUMN_SHIFT,
} from "@/lib/chargen/types";

export const AP_MAXIMUM = 99999;

/** Strip session-local baseline fields before export — mirrors Java XML (no vorgegeben tags). */
export function stripSessionBaselines(held: HeldModel): HeldModel {
  return {
    ...held,
    talents: held.talents.map(({ baselineTp: _b, ...t }) => t),
    spells: held.spells.map(({ baselineSp: _b, ...s }) => s),
    attributes: held.attributes.map(({ purchasedBaseline: _b, ...a }) => a),
    derived: held.derived.map(({ purchasedBaseline: _b, ...d }) => d),
  };
}

/** Unconditionally stamp vorgegeben floors — mirrors `einfuegenVorgegeben` on load/finish. */
export function freezeBaselines(held: HeldModel): HeldModel {
  return {
    ...held,
    talents: held.talents.map((t) => ({ ...t, baselineTp: t.tp })),
    spells: held.spells.map((s) => ({ ...s, baselineSp: s.sp })),
    attributes: held.attributes.map((a) => ({
      ...a,
      purchasedBaseline: a.purchased,
    })),
    derived: held.derived.map((d) => ({
      ...d,
      purchasedBaseline: d.purchased,
    })),
  };
}

export function finishCreation(
  held: HeldModel,
  attributeMods?: AttributeMods,
  gpRemaining?: number
): HeldModel {
  const apStart = computeApStart(held, attributeMods);
  const withAp = {
    ...held,
    phase: "veteran" as const,
    apTotal: Math.max(held.apTotal, apStart),
    gpRemaining: gpRemaining ?? held.gpRemaining,
  };
  return freezeBaselines(withAp);
}

export function loadAsVeteran(held: HeldModel): HeldModel {
  return freezeBaselines({ ...held, phase: "veteran" });
}

export function addAp(held: HeldModel, amount: number): HeldModel {
  if (amount <= 0) return held;
  return {
    ...held,
    apTotal: Math.min(AP_MAXIMUM, held.apTotal + amount),
  };
}

export function setApTotal(held: HeldModel, value: number): HeldModel {
  return {
    ...held,
    apTotal: Math.max(0, Math.min(AP_MAXIMUM, Math.round(value))),
  };
}

export function setApSpent(held: HeldModel, value: number): HeldModel {
  return {
    ...held,
    apSpent: Math.max(0, Math.round(value)),
  };
}

export function apCredit(held: HeldModel): number {
  return held.apTotal - held.apSpent;
}

function attributeStartStufe(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods?: AttributeMods
): number {
  const row = held.attributes.find((a) => a.code === code);
  if (!row) return 0;
  return row.base + attributeModsSum(code, mods);
}

function attributeModsSum(code: string, mods?: AttributeMods): number {
  if (!mods) return 0;
  return (
    (mods.race?.[code] ?? 0) +
    (mods.culture?.[code] ?? 0) +
    (mods.profession?.[code] ?? 0)
  );
}

export function attributeZukaufCap(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods?: AttributeMods
): number {
  if (code === "SO") return 0;
  return Math.round(attributeStartStufe(held, code, mods) / 2);
}

export function attributeZukaufCost(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods: AttributeMods | undefined,
  learningMethod: LearningMethod,
  specialExperience?: boolean
): number {
  const row = held.attributes.find((a) => a.code === code);
  if (!row) return 0;
  const total = attrValue(held, code) + attributeModsSum(code, mods);
  let col = ATTR_COLUMN;
  if (specialExperience) {
    col = shiftColumn(col, -1);
  } else {
    col = shiftColumn(col, LEARNING_METHOD_COLUMN_SHIFT[learningMethod]);
  }
  return sktCost(col, total + 1);
}

export function raiseAttributeZukauf(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods: AttributeMods | undefined,
  learningMethod: LearningMethod
): HeldModel {
  const row = held.attributes.find((a) => a.code === code);
  if (!row || code === "SO") return held;
  const cap = attributeZukaufCap(held, code, mods);
  if (row.purchased >= cap) return held;
  const baseline = row.purchasedBaseline ?? row.purchased;
  const nextPurchased = row.purchased + 1;
  let cost = 0;
  if (nextPurchased > baseline) {
    cost = attributeZukaufCost(
      held,
      code,
      mods,
      learningMethod,
      row.specialExperience
    );
  }
  return {
    ...held,
    attributes: held.attributes.map((a) =>
      a.code === code ? { ...a, purchased: nextPurchased } : a
    ),
    apSpent: held.apSpent + cost,
  };
}

export function lowerAttributeZukauf(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods: AttributeMods | undefined,
  learningMethod: LearningMethod
): HeldModel {
  const row = held.attributes.find((a) => a.code === code);
  if (!row || row.purchased <= 0) return held;
  const baseline = row.purchasedBaseline ?? 0;
  const from = row.purchased;
  let refund = 0;
  if (from > baseline) {
    const totalAtFrom =
      row.base + from + attributeModsSum(code, mods);
    let col = ATTR_COLUMN;
    if (row.specialExperience) {
      col = shiftColumn(col, -1);
    } else {
      col = shiftColumn(col, LEARNING_METHOD_COLUMN_SHIFT[learningMethod]);
    }
    refund = sktCost(col, totalAtFrom);
  }
  return {
    ...held,
    attributes: held.attributes.map((a) =>
      a.code === code ? { ...a, purchased: from - 1 } : a
    ),
    apSpent: Math.max(0, held.apSpent - refund),
  };
}

export interface BaseValueZukaufConfig {
  column: string;
  capAttr: AttrCodeWithSo;
  capDivisor: number;
}

const BASE_VALUE_ZUKAUF: Partial<Record<DerivedCode, BaseValueZukaufConfig>> = {
  VP: { column: "H", capAttr: "CN", capDivisor: 2 },
  EP: { column: "E", capAttr: "CN", capDivisor: 1 },
  RM: { column: "H", capAttr: "CO", capDivisor: 2 },
  ASP: { column: "G", capAttr: "CH", capDivisor: 1 },
};

export function isBaseValuePurchasable(code: DerivedCode): boolean {
  return code in BASE_VALUE_ZUKAUF;
}

export function baseValueZukaufCap(
  held: HeldModel,
  code: DerivedCode,
  mods?: AttributeMods
): number {
  const cfg = BASE_VALUE_ZUKAUF[code];
  if (!cfg) return 0;
  const attr = currentAttrValue(held, cfg.capAttr, mods);
  return Math.round(attr / cfg.capDivisor);
}

export function baseValueZukaufCost(
  held: HeldModel,
  code: DerivedCode,
  specialExperience?: boolean
): number {
  const cfg = BASE_VALUE_ZUKAUF[code];
  if (!cfg) return 0;
  const row = held.derived.find((d) => d.code === code);
  if (!row) return 0;
  let col = cfg.column;
  if (specialExperience) {
    col = shiftColumn(col, -1);
  }
  return sktCost(col, row.purchased + 1);
}

export function raiseBaseValueZukauf(
  held: HeldModel,
  code: DerivedCode,
  mods: AttributeMods | undefined
): HeldModel {
  const cfg = BASE_VALUE_ZUKAUF[code];
  if (!cfg) return held;
  const row = held.derived.find((d) => d.code === code);
  if (!row) return held;
  const cap = baseValueZukaufCap(held, code, mods);
  if (row.purchased >= cap) return held;
  const baseline = row.purchasedBaseline ?? row.purchased;
  const next = row.purchased + 1;
  let cost = 0;
  if (next > baseline) {
    cost = baseValueZukaufCost(held, code, row.specialExperience);
  }
  return {
    ...held,
    derived: held.derived.map((d) =>
      d.code === code ? { ...d, purchased: next } : d
    ),
    apSpent: held.apSpent + cost,
  };
}

export function lowerBaseValueZukauf(
  held: HeldModel,
  code: DerivedCode
): HeldModel {
  const row = held.derived.find((d) => d.code === code);
  if (!row || row.purchased <= 0) return held;
  const baseline = row.purchasedBaseline ?? 0;
  const from = row.purchased;
  let refund = 0;
  if (from > baseline) {
    const prevHeld: HeldModel = {
      ...held,
      derived: held.derived.map((d) =>
        d.code === code ? { ...d, purchased: from - 1 } : d
      ),
    };
    refund = baseValueZukaufCost(prevHeld, code, row.specialExperience);
  }
  return {
    ...held,
    derived: held.derived.map((d) =>
      d.code === code ? { ...d, purchased: from - 1 } : d
    ),
    apSpent: Math.max(0, held.apSpent - refund),
  };
}

function applyLearningMethodToSfCost(
  baseCost: number,
  learningMethod: LearningMethod,
  isSpecialization: boolean
): number {
  let cost = baseCost;
  if (learningMethod === "special_experience") {
    cost = Math.round(cost / 2);
  }
  if (
    isSpecialization &&
    learningMethod !== "teacher" &&
    learningMethod !== "special_experience"
  ) {
    cost *= 2;
  }
  return cost;
}

export function veteranSpecialAbilityCost(
  held: HeldModel,
  instance: ExpandedSpecialAbility,
  variant: string | null | undefined,
  learningMethod: LearningMethod
): number {
  const isSpec =
    instance.kosten_key === "TALENTSPEZIALISIERUNG" ||
    instance.kosten_key === "WAFFENSPEZIALISIERUNG" ||
    instance.group === "talent_specialization" ||
    instance.group === "weapon_specialization";
  const base = specializationApCost(held, instance, variant ?? null);
  return applyLearningMethodToSfCost(base, learningMethod, isSpec);
}

export function learnSpecialAbilityVeteran(
  held: HeldModel,
  instance: ExpandedSpecialAbility,
  variant: string | null | undefined,
  learningMethod: LearningMethod
): HeldModel {
  if (findOwnedForInstance(held, instance, variant ?? null)) return held;
  const cost = veteranSpecialAbilityCost(
    held,
    instance,
    variant,
    learningMethod
  );
  const entry: SpecialAbilityWert = {
    id: instance.id,
    talent: instance.talent,
    variant: variant ?? undefined,
    payment: "ap",
  };
  return {
    ...held,
    specialAbilities: [...held.specialAbilities, entry],
    apSpent: held.apSpent + cost,
  };
}

export function traitGpMagnitude(meta: CatalogItem, rating?: number): number {
  const gp = Number(meta.gp_cost ?? 0);
  if (gp < 0) return -gp;
  const per = meta.gp_per_level;
  if (per != null && Number(per) < 0) {
    return -Number(per) * (rating ?? 1);
  }
  return 0;
}

export function disadvantageBuyOffCost(
  meta: CatalogItem,
  rating?: number
): number {
  if (meta.kind !== "disadvantage") return 0;
  const mag = traitGpMagnitude(meta, rating);
  return mag * 100;
}

export function disadvantageReduceCost(
  meta: CatalogItem,
  learningMethod: LearningMethod
): number {
  if (meta.kind !== "disadvantage") return 0;
  const id = String(meta.id);
  if (id.includes("SchlechteEigenschaft")) {
    const perLevel =
      learningMethod === "self_study" || learningMethod === "mutual" ? 75 : 50;
    return perLevel;
  }
  const per = meta.gp_per_level;
  if (per != null && Number(per) < 0) {
    return Math.abs(Number(per)) * 100;
  }
  const gp = Number(meta.gp_cost ?? 0);
  if (gp < 0) return Math.abs(gp) * 100;
  return 0;
}

export function buyOffDisadvantage(
  held: HeldModel,
  traitId: string,
  meta: CatalogItem
): HeldModel {
  const row = held.advantagesDisadvantages.find((t) => t.id === traitId);
  if (!row || meta.kind !== "disadvantage") return held;
  const cost = disadvantageBuyOffCost(meta, row.rating);
  return {
    ...held,
    advantagesDisadvantages: held.advantagesDisadvantages.filter(
      (t) => t.id !== traitId
    ),
    apSpent: held.apSpent + cost,
  };
}

export function reduceDisadvantageLevel(
  held: HeldModel,
  traitId: string,
  meta: CatalogItem,
  learningMethod: LearningMethod
): HeldModel {
  const row = held.advantagesDisadvantages.find((t) => t.id === traitId);
  if (!row || meta.kind !== "disadvantage") return held;
  const rating = row.rating ?? 1;
  if (rating <= 1 && meta.gp_per_level == null) {
    return buyOffDisadvantage(held, traitId, meta);
  }
  const cost = disadvantageReduceCost(meta, learningMethod);
  if (rating <= 1) {
    return {
      ...held,
      advantagesDisadvantages: held.advantagesDisadvantages.filter(
        (t) => t.id !== traitId
      ),
      apSpent: held.apSpent + cost,
    };
  }
  return {
    ...held,
    advantagesDisadvantages: held.advantagesDisadvantages.map((t) =>
      t.id === traitId ? { ...t, rating: (t.rating ?? 1) - 1 } : t
    ),
    apSpent: held.apSpent + cost,
  };
}
