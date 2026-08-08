import type { HeldModel } from "@/lib/chargen/types";
import { emptyHeld } from "@/lib/chargen/types";
import { stripSessionBaselines } from "@/lib/chargen/rules/veteran";

export function heroDisplayName(held: HeldModel): string {
  const name = typeof held.name === "string" ? held.name.trim() : "";
  return name || "Unnamed Hero";
}

/** Validate and normalize a HeldModel for DB storage. */
export function sanitizeHeldForStorage(raw: unknown): {
  ok: true;
  held: HeldModel;
  name: string;
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "data must be an object" };
  }
  const data = raw as Partial<HeldModel>;
  if (data.format && data.format !== "dsa-nexus-chargen") {
    return {
      ok: false,
      error: `Unsupported format "${data.format}". Expected "dsa-nexus-chargen".`,
    };
  }
  if (
    data.schemaVersion != null &&
    data.schemaVersion !== 1 &&
    Number(data.schemaVersion) !== 1
  ) {
    return {
      ok: false,
      error: `Unsupported schemaVersion "${data.schemaVersion}". Expected 1.`,
    };
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
  const held = stripSessionBaselines(merged);
  return { ok: true, held, name: heroDisplayName(held) };
}
