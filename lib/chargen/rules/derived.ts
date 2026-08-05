/**
 * Recompute derived base values from attributes + race/culture/profession mods.
 * Formulas approximate DSA 4.1 / Java `Basiswert` (simplified).
 */

import type { DerivedCode, AttributeMods, HeldModel } from "@/lib/chargen/types";
import { currentAttrValue } from "@/lib/chargen/types";

function setDerived(
  held: HeldModel,
  code: DerivedCode,
  base: number,
  modification = 0
) {
  const row = held.derived.find((d) => d.code === code);
  if (row) {
    row.base = base;
    row.modification = modification;
  } else {
    held.derived.push({ code, base, modification, purchased: 0 });
  }
}

export function recomputeDerived(
  held: HeldModel,
  mods: {
    race?: Record<string, number>;
    culture?: Record<string, number>;
    profession?: Record<string, number>;
    attributeMods?: AttributeMods;
  } = {}
): void {
  const attrMods: AttributeMods = mods.attributeMods ?? {
    race: mods.race,
    culture: mods.culture,
    profession: mods.profession,
  };
  const co = currentAttrValue(held, "CO", attrMods);
  const cl = currentAttrValue(held, "CL", attrMods);
  const inn = currentAttrValue(held, "IN", attrMods);
  const ch = currentAttrValue(held, "CH", attrMods);
  const de = currentAttrValue(held, "DE", attrMods);
  const ag = currentAttrValue(held, "AG", attrMods);
  const cn = currentAttrValue(held, "CN", attrMods);
  const st = currentAttrValue(held, "ST", attrMods);

  const merge = (code: string) =>
    (mods.race?.[code] ?? 0) +
    (mods.culture?.[code] ?? 0) +
    (mods.profession?.[code] ?? 0);

  // VP ≈ (CN + CN + ST) / 2 + race mods (Java uses precise Basiswert formulas)
  setDerived(held, "VP", Math.round((cn + cn + st) / 2), merge("VP"));
  setDerived(held, "EP", Math.round((co + cn + ag) / 2), merge("EP"));
  setDerived(held, "RM", Math.round((co + cl + inn) / 5), merge("RM"));
  setDerived(held, "ASP", Math.round((co + inn + ch) / 2), merge("ASP"));
  setDerived(held, "WT", Math.round(cn / 2), merge("WT"));
  setDerived(held, "baseAT", Math.round((co + ag + st) / 5), merge("baseAT"));
  setDerived(held, "basePA", Math.round((inn + ag + st) / 5), merge("basePA"));
  setDerived(held, "baseBRV", Math.round((inn + de + st) / 5), merge("baseBRV"));
  setDerived(held, "baseINI", Math.round((co + inn + ag) / 5), merge("baseINI"));
  setDerived(held, "GS", 8, merge("GS"));
}
