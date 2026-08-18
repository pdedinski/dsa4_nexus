/**
 * Recompute derived base values from attributes + race/culture/profession mods.
 * Formulas approximate DSA 4.1 / Java `Basiswert` (simplified).
 *
 * Java model: Stufe = Basisstufe + getModifikation(Rasse/Kultur/Profession) + Zukauf + Bonus.
 * Nexus stores package mods + XML Bonus together in `modification`; export subtracts
 * package mods to write XML `Bonus`. Refresh must preserve the player XML Bonus.
 */

import type { DerivedCode, AttributeMods, HeldModel } from "@/lib/chargen/types";
import { currentAttrValue } from "@/lib/chargen/types";

function setDerivedBasePreservingPlayerBonus(
  held: HeldModel,
  code: DerivedCode,
  base: number,
  packageMod: number
) {
  const row = held.derived.find((d) => d.code === code);
  if (row) {
    // After DCG import, packageBaseline is 0 so modification is treated as XML Bonus.
    // After DB load (no packageBaseline), assume modification already includes current pkg.
    const prevPkg = row.packageBaseline ?? packageMod;
    const playerBonus = row.modification - prevPkg;
    row.base = base;
    row.modification = packageMod + playerBonus;
    row.packageBaseline = packageMod;
  } else {
    held.derived.push({
      code,
      base,
      modification: packageMod,
      purchased: 0,
      packageBaseline: packageMod,
    });
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
  setDerivedBasePreservingPlayerBonus(
    held,
    "VP",
    Math.round((cn + cn + st) / 2),
    merge("VP")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "EP",
    Math.round((co + cn + ag) / 2),
    merge("EP")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "RM",
    Math.round((co + cl + inn) / 5),
    merge("RM")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "ASP",
    Math.round((co + inn + ch) / 2),
    merge("ASP")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "WT",
    Math.round(cn / 2),
    merge("WT")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "baseAT",
    Math.round((co + ag + st) / 5),
    merge("baseAT")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "basePA",
    Math.round((inn + ag + st) / 5),
    merge("basePA")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "baseBRV",
    Math.round((inn + de + st) / 5),
    merge("baseBRV")
  );
  setDerivedBasePreservingPlayerBonus(
    held,
    "baseINI",
    Math.round((co + inn + ag) / 5),
    merge("baseINI")
  );
  setDerivedBasePreservingPlayerBonus(held, "GS", 8, merge("GS"));
}
