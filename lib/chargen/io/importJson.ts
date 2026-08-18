import type { HeldModel } from "@/lib/chargen/types";
import { emptyHeld } from "@/lib/chargen/types";
import { loadAsVeteran } from "@/lib/chargen/rules/veteran";
import { canonicalizeHeldTraitVariants } from "@/lib/chargen/rules/talentGroupVariants";

export function importHeldJson(raw: string): HeldModel {
  const data = JSON.parse(raw) as Partial<HeldModel>;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON: expected an object.");
  }
  if (data.format && data.format !== "dsa-nexus-chargen") {
    throw new Error(
      `Unsupported format "${data.format}". Expected "dsa-nexus-chargen".`
    );
  }
  const base = emptyHeld();
  const merged: HeldModel = {
    ...base,
    ...data,
    schemaVersion: 1,
    format: "dsa-nexus-chargen",
    attributes: data.attributes?.length ? data.attributes : base.attributes,
    derived: data.derived?.length ? data.derived : base.derived,
    talents: data.talents ?? [],
    spells: data.spells ?? [],
    advantagesDisadvantages: data.advantagesDisadvantages ?? [],
    specialAbilities: data.specialAbilities ?? [],
    meleeWeapons: data.meleeWeapons ?? [],
    rangedWeapons: data.rangedWeapons ?? [],
    armors: data.armors ?? [],
    shields: data.shields ?? [],
    leadTalents: data.leadTalents ?? [],
    houseSpells: data.houseSpells ?? [],
    leadSpells: data.leadSpells ?? [],
    discountedSpecialAbilities: data.discountedSpecialAbilities ?? [],
    discountedSpecialAbilityVariants:
      data.discountedSpecialAbilityVariants ?? [],
  };
  return loadAsVeteran(canonicalizeHeldTraitVariants(merged));
}
