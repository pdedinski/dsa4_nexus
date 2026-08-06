/**
 * Import legacy Java Chargen NanoXML `<Held>` documents.
 * Tag layout from FactoryHeldXmlIn / HeldXmlTags.
 */

import { XMLParser } from "fast-xml-parser";
import type {
  AttrCodeWithSo,
  DerivedCode,
  Gender,
  HeldModel,
} from "@/lib/chargen/types";
import {
  ATTR_FROM_GERMAN,
  DERIVED_FROM_GERMAN,
  emptyHeld,
} from "@/lib/chargen/types";
import { loadAsVeteran } from "@/lib/chargen/rules/veteran";

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v && "#text" in (v as object)) {
    return String((v as { "#text": unknown })["#text"]);
  }
  return "";
}

function numAttr(node: Record<string, unknown>, key: string, fallback = 0): number {
  const v = node[`@_${key}`] ?? node[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function boolAttr(node: Record<string, unknown>, key: string): boolean {
  return String(node[`@_${key}`] ?? "") === "true";
}

export function isLegacyHeldXml(raw: string): boolean {
  return /<\s*Held[\s>]/.test(raw);
}

export function importLegacyHeldXml(raw: string): HeldModel {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name) =>
      [
        "EigenschaftWert",
        "BasiswertWert",
        "TalentWert",
        "Talent",
        "ZauberWert",
        "Zauber",
        "VorNachteilWert",
        "SonderfertigkeitWert",
        "NahkampfwaffeWert",
        "FernkampfwaffeWert",
        "RuestungWert",
        "SchildWert",
      ].includes(name),
  });
  const parsed = parser.parse(raw);
  const heldNode = parsed.Held;
  if (!heldNode) throw new Error("Not a legacy <Held> document.");

  const held = emptyHeld();
  held.name = textOf(heldNode.Name);
  held.raceId = textOf(heldNode.Rasse);
  held.cultureId = textOf(heldNode.Kultur);
  held.professionId = textOf(heldNode.Profession);
  const g = textOf(heldNode.Geschlecht).toUpperCase();
  held.gender = (g.includes("WEIB") || g.includes("FEMALE")
    ? "female"
    : "male") as Gender;
  held.birthday = textOf(heldNode.Geburtstag);
  held.age = Number(textOf(heldNode.Alter)) || held.age;
  held.heightCm = Number(textOf(heldNode.Groesse)) || held.heightCm;
  held.weightKg = Number(textOf(heldNode.Gewicht)) || held.weightKg;
  held.hairColor = textOf(heldNode.Haarfarbe);
  held.eyeColor = textOf(heldNode.Augenfarbe);
  held.appearance = textOf(heldNode.Aussehen);
  held.status = textOf(heldNode.Stand);
  held.title = textOf(heldNode.Titel);
  held.background = textOf(heldNode.Hintergrund);
  held.apTotal = Number(textOf(heldNode.GesamtAp)) || 0;
  held.apSpent = Number(textOf(heldNode.EingesetzteAp)) || 0;
  held.motherTongue = textOf(heldNode.Muttersprache) || undefined;
  held.secondLanguage = textOf(heldNode.Zweitsprache) || undefined;

  const attrs = asArray(heldNode.EigenschaftWerte?.EigenschaftWert);
  if (attrs.length) {
    held.attributes = held.attributes.map((a) => {
      const match = attrs.find((n) => {
        const id = String((n as Record<string, unknown>)["@_Eigenschaft"] ?? "");
        return ATTR_FROM_GERMAN[id] === a.code;
      }) as Record<string, unknown> | undefined;
      if (!match) return a;
      return {
        code: a.code as AttrCodeWithSo,
        base: numAttr(match, "Basisstufe", a.base),
        purchased: numAttr(match, "Zukauf", 0),
        specialExperience: boolAttr(match, "SpezielleErfahrung"),
      };
    });
  }

  const bases = asArray(heldNode.BasiswertWerte?.BasiswertWert);
  if (bases.length) {
    held.derived = held.derived.map((d) => {
      const match = bases.find((n) => {
        const id = String((n as Record<string, unknown>)["@_Basiswert"] ?? "");
        return DERIVED_FROM_GERMAN[id] === d.code;
      }) as Record<string, unknown> | undefined;
      if (!match) return d;
      return {
        code: d.code as DerivedCode,
        modification: numAttr(match, "Bonus", 0),
        base: d.base,
        purchased: numAttr(match, "Zukauf", 0),
        specialExperience: boolAttr(match, "SpezielleErfahrung"),
      };
    });
  }

  held.talents = asArray(heldNode.TalentWerte?.TalentWert).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_Talent"] ?? ""),
      tp: numAttr(node, "UnmodifizierteStufe", 0),
      attack:
        node["@_Attacke"] != null ? numAttr(node, "Attacke") : undefined,
      specialExperience: boolAttr(node, "SpezielleErfahrung"),
    };
  });

  held.leadTalents = asArray(heldNode.Leittalente?.Talent)
    .map(textOf)
    .filter(Boolean);

  held.spells = asArray(heldNode.ZauberWerte?.ZauberWert).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_Zauber"] ?? ""),
      sp: numAttr(node, "Stufe", 0),
      variant: node["@_Variante"]
        ? String(node["@_Variante"])
        : undefined,
      specialExperience: boolAttr(node, "SpezielleErfahrung"),
    };
  });
  held.houseSpells = asArray(heldNode.Hauszauber?.Zauber)
    .map(textOf)
    .filter(Boolean);
  held.leadSpells = asArray(heldNode.Leitzauber?.Zauber)
    .map(textOf)
    .filter(Boolean);

  held.specialAbilities = asArray(
    heldNode.SonderfertigkeitWerte?.SonderfertigkeitWert
  ).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_Sonderfertigkeit"] ?? ""),
      talent: node["@_Talent"] ? String(node["@_Talent"]) : undefined,
      variant: node["@_Variante"] ? String(node["@_Variante"]) : undefined,
    };
  });

  held.advantagesDisadvantages = asArray(
    heldNode.VorNachteilWerte?.VorNachteilWert
  ).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_VorNachteil"] ?? ""),
      rating:
        node["@_Stufe"] != null ? numAttr(node, "Stufe") : undefined,
      variant: node["@_Variante"] ? String(node["@_Variante"]) : undefined,
    };
  });

  held.meleeWeapons = asArray(heldNode.NahkampfwaffeWerte?.NahkampfwaffeWert).map(
    (n) => {
      const node = n as Record<string, unknown>;
      return {
        id: String(node["@_Nahkampfwaffe"] ?? ""),
        name: node["@_Name"] ? String(node["@_Name"]) : undefined,
        talent: node["@_Talent"] ? String(node["@_Talent"]) : undefined,
        tp: node["@_Tp"] ? String(node["@_Tp"]) : undefined,
        bf: numAttr(node, "Bf"),
        ini: numAttr(node, "Ini"),
        wmAt: numAttr(node, "WmAt"),
        wmPa: numAttr(node, "WmPa"),
        dkH: boolAttr(node, "DkH"),
        dkN: boolAttr(node, "DkN"),
        dkS: boolAttr(node, "DkS"),
        damageStep: numAttr(node, "Schadensschritt"),
        damageThreshold: numAttr(node, "Schwellenwert"),
      };
    }
  );

  held.rangedWeapons = asArray(
    heldNode.FernkampfwaffeWerte?.FernkampfwaffeWert
  ).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_Fernkampfwaffe"] ?? node["@_Nahkampfwaffe"] ?? ""),
      name: node["@_Name"] ? String(node["@_Name"]) : undefined,
      talent: node["@_Talent"] ? String(node["@_Talent"]) : undefined,
      tp: node["@_Tp"] ? String(node["@_Tp"]) : undefined,
    };
  });

  held.armors = asArray(heldNode.RuestungWerte?.RuestungWert).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_Ruestung"] ?? ""),
      name: node["@_Name"] ? String(node["@_Name"]) : undefined,
      rs: numAttr(node, "Rs"),
      be: numAttr(node, "Be"),
    };
  });

  held.shields = asArray(heldNode.SchildWerte?.SchildWert).map((n) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node["@_Schild"] ?? ""),
      name: node["@_Name"] ? String(node["@_Name"]) : undefined,
      type: node["@_Typ"] ? String(node["@_Typ"]) : undefined,
      bf: numAttr(node, "Bf"),
      ini: numAttr(node, "Ini"),
      wmAt: numAttr(node, "WmAt"),
      wmPa: numAttr(node, "WmPa"),
    };
  });

  return loadAsVeteran(held);
}
