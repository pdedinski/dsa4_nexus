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
import {
  canonicalTalentGroupVariant,
  isTalentGroupTrait,
} from "@/lib/chargen/rules/talentGroupVariants";

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

/** Java 0.8.7 .dcg files store variants as `<Variante Name="…"/>` children. */
function variantFromChild(child: unknown): string {
  if (child == null) return "";
  if (Array.isArray(child)) {
    for (const item of child) {
      const v = variantFromChild(item);
      if (v) return v;
    }
    return "";
  }
  if (typeof child === "string" || typeof child === "number") {
    return String(child).trim();
  }
  if (typeof child === "object") {
    const o = child as Record<string, unknown>;
    const name = o["@_Name"] ?? o["@_Variante"] ?? o["#text"];
    if (name != null && String(name).trim()) return String(name).trim();
  }
  return "";
}

function readVariant(node: Record<string, unknown>): string | undefined {
  const attr = node["@_Variante"];
  if (attr != null && String(attr).trim()) return String(attr).trim();
  const fromChild = variantFromChild(node.Variante);
  if (fromChild) return fromChild;
  const selfName = node["@_Name"];
  if (selfName != null && String(selfName).trim()) return String(selfName).trim();
  return undefined;
}

function xmlAttr(attrs: string, name: string): string {
  const dq = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  if (dq) return dq[1];
  const sq = attrs.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return sq?.[1] ?? "";
}

function childVarianteName(body: string): string {
  const dq = body.match(/<Variante\b[^>]*\bName\s*=\s*"([^"]*)"/i);
  if (dq) return dq[1];
  const sq = body.match(/<Variante\b[^>]*\bName\s*=\s*'([^']*)'/i);
  return sq?.[1] ?? "";
}

/** Recover Variante from raw XML (attribute or `<Variante Name>` child). */
function traitVariantsFromRawXml(raw: string): string[] {
  const out: string[] = [];
  const re =
    /<VorNachteilWert\b([^>/]*)(?:\/>|>([\s\S]*?)<\/VorNachteilWert>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    out.push(xmlAttr(m[1] || "", "Variante") || childVarianteName(m[2] || ""));
  }
  return out;
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
        "Sonderfertigkeit",
        "NahkampfwaffeWert",
        "FernkampfwaffeWert",
        "RuestungWert",
        "SchildWert",
        "Variante",
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
  const kapitalRaw = textOf(heldNode.Kapital);
  if (kapitalRaw !== "") {
    const n = Number(kapitalRaw);
    if (Number.isFinite(n)) held.kapital = n;
  }
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
    const activatedRaw = node["@_Aktiviert"];
    return {
      id: String(node["@_Talent"] ?? ""),
      tp: numAttr(node, "UnmodifizierteStufe", 0),
      attack:
        node["@_Attacke"] != null ? numAttr(node, "Attacke") : undefined,
      specialExperience: boolAttr(node, "SpezielleErfahrung"),
      activated:
        activatedRaw != null ? String(activatedRaw) === "true" : undefined,
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
      variant: readVariant(node),
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
      variant: readVariant(node),
    };
  });

  held.discountedSpecialAbilities = asArray(
    heldNode.VerbilligteSonderfertigkeiten?.Sonderfertigkeit
  )
    .map((n) => {
      if (typeof n === "string") return n;
      const node = n as Record<string, unknown>;
      return String(node["@_Sonderfertigkeit"] ?? textOf(n) ?? "");
    })
    .filter(Boolean);

  // Held XML: SonderfertigkeitWert children; some baustein dumps use Variante.
  const verbilligteVarianten = [
    ...asArray(heldNode.VerbilligteVarianten?.SonderfertigkeitWert),
    ...asArray(heldNode.VerbilligteVarianten?.Variante),
  ];
  held.discountedSpecialAbilityVariants = verbilligteVarianten
    .map((n) => {
      const node = n as Record<string, unknown>;
      const id = String(node["@_Sonderfertigkeit"] ?? "");
      if (!id) return null;
      return {
        id,
        talent: node["@_Talent"] ? String(node["@_Talent"]) : undefined,
        variant: readVariant(node),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  const rawTraitVariants = traitVariantsFromRawXml(raw);
  held.advantagesDisadvantages = asArray(
    heldNode.VorNachteilWerte?.VorNachteilWert
  ).map((n, i) => {
    const node = n as Record<string, unknown>;
    const id = String(node["@_VorNachteil"] ?? "");
    let variant = readVariant(node) || rawTraitVariants[i] || undefined;
    if (variant && isTalentGroupTrait(id)) {
      variant = canonicalTalentGroupVariant(variant) || variant;
    }
    return {
      id,
      rating:
        node["@_Stufe"] != null ? numAttr(node, "Stufe") : undefined,
      variant: variant || undefined,
      specialExperience: boolAttr(node, "SpezielleErfahrung") || undefined,
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
    const rangesRaw = node["@_Reichweiten"]
      ? String(node["@_Reichweiten"])
      : "";
    const tpPlusRaw = node["@_TpPlus"] ? String(node["@_TpPlus"]) : "";
    const parseList = (raw: string) =>
      raw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((x) => Number.isFinite(x));
    return {
      id: String(node["@_Fernkampfwaffe"] ?? node["@_Nahkampfwaffe"] ?? ""),
      name: node["@_Name"] ? String(node["@_Name"]) : undefined,
      talent: node["@_Talent"] ? String(node["@_Talent"]) : undefined,
      tp: node["@_Tp"] ? String(node["@_Tp"]) : undefined,
      ranges: rangesRaw ? parseList(rangesRaw) : undefined,
      tpPlus: tpPlusRaw ? parseList(tpPlusRaw) : undefined,
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

  // XML Bonus is player-stored only. Mark xmlBonusOnly so the first
  // recomputeDerived treats modification as pure Bonus (not already-folded package).
  for (const d of held.derived) {
    d.xmlBonusOnly = true;
    delete d.packageBaseline;
  }

  return loadAsVeteran(held);
}
