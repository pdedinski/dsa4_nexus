/**
 * Import/export Charbuilder custom-data for races, cultures and professions.
 *
 * Unlike equipment XML (`charbuilderXml.ts`), each `.ras` / `.kul` / `.pro`
 * (or `.xml`) file holds exactly one root element — `<Rasse>`, `<Kultur>` or
 * `<Profession>` — with no wrapper list. Field mapping mirrors
 * `scripts/chargen-extract/extract-all.mjs` `extractBausteine()` so parsed
 * entries land in the same shape as `lib/chargen/data/{rassen,kulturen,professionen}.json`.
 */

import { XMLParser } from "fast-xml-parser";
import {
  getBuiltinCatalog,
  type CatalogItem,
} from "@/lib/chargen/data/builtinCatalog";
import { applyBuiltinLocalization } from "@/lib/chargen/data/builtinLocalization";
import {
  ATTR_FROM_GERMAN,
  ATTR_TO_GERMAN,
  DERIVED_FROM_GERMAN,
  DERIVED_TO_GERMAN,
  type AttrCodeWithSo,
  type DerivedCode,
} from "@/lib/chargen/types";

export type CharbuilderBausteinCategory =
  | "races"
  | "cultures"
  | "professions";

export const CHARBUILDER_BAUSTEIN_CATEGORIES: CharbuilderBausteinCategory[] = [
  "races",
  "cultures",
  "professions",
];

const ROOT_TAG: Record<CharbuilderBausteinCategory, string> = {
  races: "Rasse",
  cultures: "Kultur",
  professions: "Profession",
};

const FILE_EXT: Record<CharbuilderBausteinCategory, string> = {
  races: "ras",
  cultures: "kul",
  professions: "pro",
};

const TALENT_LIST_MARKER_TAGS = [
  "Fremdsprachen",
  "Muttersprache",
  "NichtMuttersprache",
  "SchriftenMuttersprache",
] as const;

const TERRAIN_SF_IDS = [
  "Sonderfertigkeit.Dschungelkundig",
  "Sonderfertigkeit.Eiskundig",
  "Sonderfertigkeit.Gebirgskundig",
  "Sonderfertigkeit.Hoehlenkundig",
  "Sonderfertigkeit.Maraskankundig",
  "Sonderfertigkeit.Meereskundig",
  "Sonderfertigkeit.Steppenkundig",
  "Sonderfertigkeit.Sumpfkundig",
  "Sonderfertigkeit.Waldkundig",
  "Sonderfertigkeit.Wuestenkundig",
];

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && v && "#text" in (v as object)) {
    return String((v as { "#text": unknown })["#text"]);
  }
  return null;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanizeId(id: string): string {
  const seg = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
  return seg.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function makeParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name, jpath) => {
      if (jpath === "Kultur" || jpath === "Rasse" || jpath === "Profession") {
        return false;
      }
      return [
        "Eintrag",
        "Kultur",
        "Profession",
        "VorNachteil",
        "Talent",
        "Fest",
        "Frei",
        "AlteSpracheBosparanoUrTulamidya",
        "Gelaendekunde",
        "Bonus",
        "BasiswertModifikation",
        "EigenschaftModifikation",
        "Sonderfertigkeit",
        "Zauber",
        "ZauberBonus",
        "Werte",
        "TalentListe",
        "Sprache",
        "Wert",
        "Rasse",
        "Besitz",
        "Variante",
      ].includes(name);
    },
  });
}

/**
 * Sniff which baustein category an XML document holds from its *document root*
 * tag (first element after an optional XML declaration). Do not scan the whole
 * body — profession files may contain nested `<Rasse Rasse="…"/>` cost rows.
 */
export function detectCharbuilderBausteinCategory(
  xml: string
): CharbuilderBausteinCategory | null {
  const stripped = xml.replace(/^\uFEFF/, "").replace(/^<\?xml[\s\S]*?\?>\s*/i, "");
  const m = /^\s*<\s*([A-Za-z][\w.-]*)/.exec(stripped);
  if (!m) return null;
  const tag = m[1];
  for (const cat of CHARBUILDER_BAUSTEIN_CATEGORIES) {
    if (ROOT_TAG[cat] === tag) return cat;
  }
  return null;
}

function extractTalentListeIds(festOrFrei: Record<string, unknown>): string[] {
  const talents: string[] = [];
  for (const tl of asArray(festOrFrei.TalentListe)) {
    if (tl == null) continue;
    if (typeof tl === "string") {
      if (tl) talents.push(tl);
      continue;
    }
    const tlObj = tl as Record<string, unknown>;
    for (const t of asArray(tlObj.Talent)) {
      const id = textOf(t);
      if (id) talents.push(id);
    }
    for (const marker of TALENT_LIST_MARKER_TAGS) {
      if (Object.prototype.hasOwnProperty.call(tlObj, marker)) {
        talents.push(marker);
      }
    }
  }
  const direct = asArray(festOrFrei.Talent).map(textOf).filter(Boolean) as string[];
  return talents.length ? talents : direct;
}

function extractTalentBoni(node: Record<string, unknown> | undefined) {
  if (!node) return [];
  const out: Record<string, unknown>[] = [];
  for (const fest of asArray(node.Fest as unknown[])) {
    const f = fest as Record<string, unknown>;
    const list = extractTalentListeIds(f);
    let bonuses = asArray(f.Bonus)
      .map((b) => Number(textOf(b) ?? b))
      .filter((n) => Number.isFinite(n));
    if (!bonuses.length && f.Bonus != null) {
      bonuses = [Number(f.Bonus)];
    }
    const isMarker =
      list.length === 1 &&
      (TALENT_LIST_MARKER_TAGS as readonly string[]).includes(list[0]);
    out.push({
      type: "fixed",
      bonus: bonuses[0] ?? 0,
      bonuses,
      talents: list,
      open: list.length > 1 || isMarker,
      lead:
        f["@_Leittalent"] != null &&
        String(f["@_Leittalent"]).toLowerCase() !== "false",
      ...(f["@_Typ"] ? { typ: String(f["@_Typ"]) } : {}),
    });
  }
  for (const frei of asArray(node.Frei as unknown[])) {
    const fr = frei as Record<string, unknown>;
    const list = extractTalentListeIds(fr);
    const points = Number(fr["@_Bonus"] ?? fr.Bonus ?? fr.Punkte ?? 0);
    out.push({
      type: "free",
      points,
      bonus: points,
      talents: list,
      open: true,
    });
  }
  for (const alte of asArray(node.AlteSpracheBosparanoUrTulamidya as unknown[])) {
    const a = alte as Record<string, unknown>;
    let bonuses = asArray(a.Bonus)
      .map((b) => Number(textOf(b) ?? b))
      .filter((n) => Number.isFinite(n));
    if (!bonuses.length && a.Bonus != null) {
      bonuses = [Number(a.Bonus)];
    }
    out.push({
      type: "ancient_language",
      bonus: bonuses[0] ?? 0,
      bonuses,
      talents: ["Talent.Bosparano", "Talent.UrTulamidya"],
      open: false,
      lead: false,
    });
  }
  return out;
}

function extractSfBoni(node: Record<string, unknown> | undefined) {
  if (!node) return [];
  const out: Record<string, unknown>[] = [];

  const parseWert = (w: unknown) => {
    if (!w) return null;
    if (typeof w === "string") return { id: w, variant: null, talent: undefined };
    const wo = w as Record<string, unknown>;
    const id = (wo["@_Sonderfertigkeit"] as string) || textOf(w);
    if (!id) return null;
    return {
      id,
      variant: (wo["@_Variante"] as string) || null,
      talent: (wo["@_Talent"] as string) || undefined,
    };
  };

  const blocks = asArray(node.Werte);
  for (const block of blocks) {
    const b = block as Record<string, unknown> | undefined;
    const werte = asArray(b?.Wert ?? block)
      .map(parseWert)
      .filter(Boolean) as Array<{
      id: string;
      variant: string | null;
      talent?: string;
    }>;
    if (!werte.length) continue;
    if (werte.length === 1) {
      out.push({ ...werte[0], open: false });
    } else {
      out.push({ open: true, choices: werte });
    }
  }

  if (!blocks.length) {
    for (const w of asArray(node.Wert).map(parseWert).filter(Boolean)) {
      out.push({ ...(w as object), open: false });
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(node, "Gelaendekunde") ||
    asArray(node.Gelaendekunde).length
  ) {
    out.push({
      open: true,
      kind: "terrain_knowledge",
      choices: TERRAIN_SF_IDS.map((id) => ({ id, variant: null })),
    });
  }

  return out;
}

function extractSpellBoni(node: Record<string, unknown> | undefined) {
  if (!node) return [];
  return asArray(node.ZauberBonus ?? node)
    .map((z) => {
      if (typeof z === "string") {
        return { id: z, bonus: 0, house: false, variant: null };
      }
      const zo = z as Record<string, unknown>;
      const id = (zo["@_Zauber"] as string) || textOf(z);
      if (!id) return null;
      return {
        id,
        bonus: Number(zo["@_Bonus"] ?? textOf(zo.Bonus) ?? 0) || 0,
        house: String(zo["@_Hauszauber"] ?? "false").toLowerCase() === "true",
        variant: (zo["@_Variante"] as string) || null,
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    bonus: number;
    house: boolean;
    variant: string | null;
  }>;
}

function extractVerbilligteSf(node: Record<string, unknown> | undefined) {
  if (!node) return [];
  const out: Record<string, unknown>[] = [];
  for (const s of asArray(node.Sonderfertigkeit)) {
    if (typeof s === "string") {
      out.push({ id: s });
      continue;
    }
    const so = s as Record<string, unknown>;
    const id = (so["@_Sonderfertigkeit"] as string) || textOf(s);
    if (id) out.push({ id, variant: (so["@_Variante"] as string) || null });
  }
  if (
    Object.prototype.hasOwnProperty.call(node, "Gelaendekunde") ||
    asArray(node.Gelaendekunde).length
  ) {
    out.push({
      open: true,
      kind: "terrain_knowledge",
      choices: TERRAIN_SF_IDS.map((id) => ({ id, variant: null })),
    });
  }
  return out;
}

function extractVerbilligteVarianten(
  node: Record<string, unknown> | undefined
) {
  if (!node) return [];
  return asArray(node.Variante)
    .map((v) => {
      if (!v || typeof v === "string") return null;
      const vo = v as Record<string, unknown>;
      const id = (vo["@_Sonderfertigkeit"] as string) || textOf(v);
      if (!id) return null;
      return {
        id,
        variant: (vo["@_Variante"] as string) || null,
        description: (vo["@_Beschreibung"] as string) || null,
      };
    })
    .filter(Boolean);
}

function extractMods(node: Record<string, unknown> | undefined) {
  const attribute_modifiers: Record<string, number> = {};
  const derived_modifiers: Record<string, number> = {};
  if (!node) return { attribute_modifiers, derived_modifiers };
  for (const m of asArray(node.EigenschaftModifikation)) {
    const mo = m as Record<string, unknown>;
    const id =
      (mo["@_Eigenschaft"] as string) || textOf(mo.Eigenschaft) || "";
    const code = ATTR_FROM_GERMAN[id] || id;
    attribute_modifiers[code] = Number(
      mo["@_Modifikation"] ?? mo.Modifikation ?? 0
    );
  }
  for (const m of asArray(node.BasiswertModifikation)) {
    const mo = m as Record<string, unknown>;
    const id = (mo["@_Basiswert"] as string) || textOf(mo.Basiswert) || "";
    const code = DERIVED_FROM_GERMAN[id] || id;
    derived_modifiers[code] = Number(
      mo["@_Modifikation"] ?? mo.Modifikation ?? 0
    );
  }
  return { attribute_modifiers, derived_modifiers };
}

function extractVnList(node: unknown) {
  return asArray(node)
    .map((v) => {
      if (typeof v === "string") return { id: v };
      const vo = v as Record<string, unknown>;
      const id = textOf(v);
      const except = vo["@_Ausser"];
      return except ? { id, except } : { id };
    })
    .filter((x) => x.id);
}

function extractVnBoni(node: Record<string, unknown> | undefined) {
  if (!node) return [];
  const out: Record<string, unknown>[] = [];
  for (const werte of asArray(node.Werte ?? node)) {
    const werteNode =
      (werte as Record<string, unknown>)?.Wert != null
        ? (werte as Record<string, unknown>)
        : { Wert: werte };
    for (const w of asArray(werteNode.Wert)) {
      if (!w) continue;
      if (typeof w === "string") {
        out.push({ id: w });
        continue;
      }
      const wo = w as Record<string, unknown>;
      const id = (wo["@_VorNachteil"] as string) || textOf(w);
      if (!id) continue;
      out.push({
        id,
        variant: (wo["@_Variante"] as string) || null,
        rating: wo["@_Stufe"] != null ? Number(wo["@_Stufe"]) : null,
        open: false,
      });
    }
    const ids = asArray(werteNode.Wert)
      .map((w) =>
        typeof w === "string"
          ? w
          : (w as Record<string, unknown>)?.["@_VorNachteil"] || textOf(w)
      )
      .filter(Boolean) as string[];
    if (ids.length > 1) {
      out.splice(out.length - ids.length, ids.length, {
        id: null,
        choices: ids.map((id, i) => {
          const w = asArray(werteNode.Wert)[i];
          return {
            id,
            variant:
              typeof w === "object" && w
                ? ((w as Record<string, unknown>)["@_Variante"] as string) ||
                  null
                : null,
            rating:
              typeof w === "object" &&
              w &&
              (w as Record<string, unknown>)["@_Stufe"] != null
                ? Number((w as Record<string, unknown>)["@_Stufe"])
                : null,
          };
        }),
        open: true,
      });
    }
  }
  return out;
}

function extractProfessions(node: Record<string, unknown> | undefined) {
  if (!node) return { mode: "all", exclude: [], include: [] };
  if (node.AlleAusser) {
    const aa = node.AlleAusser as Record<string, unknown>;
    return {
      mode: "all_except",
      exclude: asArray(aa.Profession).map(textOf).filter(Boolean),
      include: [],
    };
  }
  if (node.KeineAusser) {
    const ka = node.KeineAusser as Record<string, unknown>;
    return {
      mode: "none_except",
      exclude: [],
      include: asArray(ka.Profession).map(textOf).filter(Boolean),
    };
  }
  return {
    mode: "list",
    exclude: [],
    include: asArray(node.Profession).map(textOf).filter(Boolean),
  };
}

function extractSpecialPossessions(
  node: Record<string, unknown> | undefined
): string[] {
  if (!node) return [];
  return asArray(node.Besitz).map(textOf).filter(Boolean) as string[];
}

/**
 * Parse a single Charbuilder baustein XML document into one catalog entry.
 * Throws if the root tag doesn't match the expected category or Id is missing.
 */
export function parseCharbuilderBausteinXml(
  category: CharbuilderBausteinCategory,
  xml: string
): CatalogItem {
  const parsed = makeParser().parse(xml) as Record<string, unknown>;
  let root = parsed[ROOT_TAG[category]] as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  if (Array.isArray(root)) root = root[0];
  if (!root) {
    throw new Error(
      `Expected a <${ROOT_TAG[category]}> root element for ${category}.`
    );
  }

  const id = textOf(root.Id);
  if (!id) {
    throw new Error(`Missing <Id> in <${ROOT_TAG[category]}> document.`);
  }

  const fallback = humanizeId(id);
  const kosten = root.Kosten as Record<string, unknown> | undefined;
  let gp = 0;
  let gp_cost_by_race: Record<string, number> | undefined;
  if (kosten?.Fest != null) {
    gp = Number(textOf(kosten.Fest) ?? kosten.Fest) || 0;
  } else if (kosten?.KostenRasse) {
    const kr = kosten.KostenRasse as Record<string, unknown>;
    if (kr.Normal != null) gp = Number(textOf(kr.Normal) ?? kr.Normal) || 0;
    const byRace: Record<string, number> = {};
    for (const r of asArray(kr.Rasse)) {
      const ro = r as Record<string, unknown>;
      const raceId = (ro["@_Rasse"] as string) || textOf(r);
      const cost = Number(ro["@_Kosten"] ?? textOf(ro.Kosten) ?? 0);
      if (raceId && Number.isFinite(cost)) byRace[raceId] = cost;
    }
    if (Object.keys(byRace).length) gp_cost_by_race = byRace;
  } else if (kosten?.["#text"] != null) {
    gp = Number(kosten["#text"]);
  }

  const mods = extractMods(root.Modifikationen as Record<string, unknown>);
  const item: CatalogItem = {
    id,
    name: fallback,
    german_name: fallback,
    gp_cost: gp,
    ...(gp_cost_by_race ? { gp_cost_by_race } : {}),
    ...mods,
    talent_bonuses: extractTalentBoni(
      root.TalentBoni as Record<string, unknown>
    ),
    lead_talents: asArray(
      (root.Leittalente as Record<string, unknown> | undefined)?.Talent
    )
      .map(textOf)
      .filter(Boolean),
    advantage_bonuses: extractVnBoni(
      root.VorteilBoni as Record<string, unknown>
    ),
    disadvantage_bonuses: extractVnBoni(
      root.NachteilBoni as Record<string, unknown>
    ),
    recommended_advantages_disadvantages: extractVnList(
      (root.EmpfohleneVorNachteile as Record<string, unknown> | undefined)
        ?.VorNachteil
    ),
    unsuitable_advantages_disadvantages: extractVnList(
      (root.UngeeigneteVorNachteile as Record<string, unknown> | undefined)
        ?.VorNachteil
    ),
    source: "custom",
  };

  const possessions = extractSpecialPossessions(
    root.BesondererBesitz as Record<string, unknown>
  );
  if (possessions.length) item.special_possessions = possessions;

  if (category === "races") {
    item.allowed_cultures = asArray(
      (root.Kulturen as Record<string, unknown> | undefined)?.Kultur
    )
      .map(textOf)
      .filter(Boolean);
    const alter = root.Alter as Record<string, unknown> | undefined;
    item.age = alter
      ? {
          base: Number(alter["@_Basis"] ?? 0),
          dice: Number(alter["@_Wuerfel"] ?? 0),
        }
      : null;
    const kg = root.Koerpergroesse as Record<string, unknown> | undefined;
    item.height = kg
      ? {
          base: Number(kg["@_Basis"] ?? 0),
          w6: Number(kg["@_W6"] ?? 0),
          w20: Number(kg["@_W20"] ?? 0),
        }
      : null;
    item.weight_factor =
      root.Gewicht != null ? Number(textOf(root.Gewicht)) : null;
    item.hair_colors = asArray(
      (root.Haarfarben as Record<string, unknown> | undefined)?.Eintrag
    ).map((e) => {
      const eo = e as Record<string, unknown>;
      return {
        from: Number(eo["@_von"]),
        to: Number(eo["@_bis"]),
        result: eo["@_Ergebnis"],
      };
    });
    item.eye_colors = asArray(
      (root.Augenfarben as Record<string, unknown> | undefined)?.Eintrag
    ).map((e) => {
      const eo = e as Record<string, unknown>;
      return {
        from: Number(eo["@_von"]),
        to: Number(eo["@_bis"]),
        result: eo["@_Ergebnis"],
      };
    });
    item.special_ability_bonuses = extractSfBoni(
      root.SonderfertigkeitBoni as Record<string, unknown>
    );
    item.discounted_special_abilities = extractVerbilligteSf(
      root.VerbilligteSonderfertigkeiten as Record<string, unknown>
    );
  }

  if (category === "cultures") {
    item.mother_tongue = textOf(root.Muttersprache);
    item.second_languages = asArray(
      (root.Zweitsprachen as Record<string, unknown> | undefined)?.Sprache ??
        (root.Zweitsprache as Record<string, unknown> | undefined)?.Talent ??
        (root.Zweitsprachen as Record<string, unknown> | undefined)?.Talent
    )
      .map(textOf)
      .filter(Boolean);
    item.professions = extractProfessions(
      root.Professionen as Record<string, unknown>
    );
    item.name_factory = (root["@_NameFactory"] as string) || null;
    item.special_ability_bonuses = extractSfBoni(
      root.SonderfertigkeitBoni as Record<string, unknown>
    );
    item.discounted_special_abilities = extractVerbilligteSf(
      root.VerbilligteSonderfertigkeiten as Record<string, unknown>
    );
    item.discounted_special_ability_variants = extractVerbilligteVarianten(
      root.VerbilligteVarianten as Record<string, unknown>
    );
    item.special_abilities = (
      item.special_ability_bonuses as Array<{ id?: string; open?: boolean }>
    )
      .filter((s) => s.id && !s.open)
      .map((s) => s.id);
    item.spell_bonuses = extractSpellBoni(
      root.ZauberBoni as Record<string, unknown>
    );
    item.spells = (
      item.spell_bonuses as Array<{ id: string }>
    ).map((s) => s.id);
    item.lead_spell_count =
      root.Leitzauber != null
        ? Number(textOf(root.Leitzauber) ?? root.Leitzauber) || 0
        : 0;
  }

  if (category === "professions") {
    item.requirements = [];
    item.special_ability_bonuses = extractSfBoni(
      root.SonderfertigkeitBoni as Record<string, unknown>
    );
    item.discounted_special_abilities = extractVerbilligteSf(
      root.VerbilligteSonderfertigkeiten as Record<string, unknown>
    );
    item.discounted_special_ability_variants = extractVerbilligteVarianten(
      root.VerbilligteVarianten as Record<string, unknown>
    );
    item.special_abilities = (
      item.special_ability_bonuses as Array<{ id?: string; open?: boolean }>
    )
      .filter((s) => s.id && !s.open)
      .map((s) => s.id);
    item.spell_bonuses = extractSpellBoni(
      root.ZauberBoni as Record<string, unknown>
    );
    item.spells = (
      item.spell_bonuses as Array<{ id: string }>
    ).map((s) => s.id);

    const vors = (root.Voraussetzungen as Record<string, unknown>) || {};
    const so = (root.So || vors.So) as Record<string, unknown> | undefined;
    if (so) {
      item.so_min =
        so["@_Mindeststufe"] != null ? Number(so["@_Mindeststufe"]) : 0;
      item.so_max =
        so["@_Hoechststufe"] != null ? Number(so["@_Hoechststufe"]) : 13;
    } else {
      item.so_min = 0;
      item.so_max = 13;
    }
    const attrMins: Record<string, number> = {};
    for (const m of asArray(vors.Mindeststufe ?? root.Mindeststufe)) {
      const mo = m as Record<string, unknown>;
      const level = Number(mo["@_Mindeststufe"] ?? 0);
      for (const e of asArray(mo.Eigenschaft)) {
        const raw = textOf(e);
        const code = raw ? ATTR_FROM_GERMAN[raw] : undefined;
        if (code) attrMins[code] = Math.max(attrMins[code] || 0, level);
      }
    }
    // Rebuild in stable ATTR order for deterministic round-trips
    const orderedMins: Record<string, number> = {};
    for (const code of ["CO", "CL", "IN", "CH", "DE", "AG", "CN", "ST", "SO"]) {
      if (attrMins[code] != null) orderedMins[code] = attrMins[code];
    }
    item.attribute_minimums = orderedMins;
  }

  const builtin = getBuiltinCatalog(category).find((b) => b.id === id);
  return applyBuiltinLocalization(item, builtin);
}

// ── Serialization ──────────────────────────────────────────────────────────

function indent(level: number): string {
  return "    ".repeat(level);
}

function serializeKosten(item: CatalogItem, level: number): string[] {
  const lines: string[] = [];
  const byRace = item.gp_cost_by_race as Record<string, number> | undefined;
  const gp = Number(item.gp_cost ?? 0);
  lines.push(`${indent(level)}<Kosten>`);
  if (byRace && Object.keys(byRace).length) {
    lines.push(`${indent(level + 1)}<KostenRasse>`);
    for (const [raceId, cost] of Object.entries(byRace)) {
      lines.push(
        `${indent(level + 2)}<Rasse Rasse="${esc(raceId)}" Kosten="${cost}"/>`
      );
    }
    lines.push(`${indent(level + 2)}<Normal>${gp}</Normal>`);
    lines.push(`${indent(level + 1)}</KostenRasse>`);
  } else {
    lines.push(`${indent(level + 1)}<Fest>${gp}</Fest>`);
  }
  lines.push(`${indent(level)}</Kosten>`);
  return lines;
}

function serializeMods(item: CatalogItem, level: number): string[] {
  const attr = (item.attribute_modifiers as Record<string, number>) || {};
  const der = (item.derived_modifiers as Record<string, number>) || {};
  const attrEntries = Object.entries(attr).filter(([, v]) => v !== 0);
  const derEntries = Object.entries(der).filter(([, v]) => v !== 0);
  if (!attrEntries.length && !derEntries.length) return [];
  const lines: string[] = [`${indent(level)}<Modifikationen>`];
  for (const [code, mod] of attrEntries) {
    const ger =
      ATTR_TO_GERMAN[code as AttrCodeWithSo] ||
      (code.startsWith("Eigenschaft.") ? code : `Eigenschaft.${code}`);
    lines.push(
      `${indent(level + 1)}<EigenschaftModifikation Eigenschaft="${esc(ger)}" Modifikation="${mod}"/>`
    );
  }
  for (const [code, mod] of derEntries) {
    const ger =
      DERIVED_TO_GERMAN[code as DerivedCode] ||
      (code.startsWith("Basiswert.") ? code : `Basiswert.${code}`);
    lines.push(
      `${indent(level + 1)}<BasiswertModifikation Basiswert="${esc(ger)}" Modifikation="${mod}"/>`
    );
  }
  lines.push(`${indent(level)}</Modifikationen>`);
  return lines;
}

function serializeVnBoni(
  tag: string,
  bonuses: unknown[] | undefined,
  level: number
): string[] {
  if (!bonuses?.length) return [];
  const lines: string[] = [`${indent(level)}<${tag}>`];
  for (const b of bonuses) {
    const bo = b as Record<string, unknown>;
    if (bo.open && Array.isArray(bo.choices)) {
      lines.push(`${indent(level + 1)}<Werte>`);
      for (const c of bo.choices as Array<Record<string, unknown>>) {
        const attrs = [`VorNachteil="${esc(String(c.id))}"`];
        if (c.variant) attrs.push(`Variante="${esc(String(c.variant))}"`);
        if (c.rating != null) attrs.push(`Stufe="${c.rating}"`);
        lines.push(`${indent(level + 2)}<Wert ${attrs.join(" ")}/>`);
      }
      lines.push(`${indent(level + 1)}</Werte>`);
    } else if (bo.id) {
      lines.push(`${indent(level + 1)}<Werte>`);
      const attrs = [`VorNachteil="${esc(String(bo.id))}"`];
      if (bo.variant) attrs.push(`Variante="${esc(String(bo.variant))}"`);
      if (bo.rating != null) attrs.push(`Stufe="${bo.rating}"`);
      lines.push(`${indent(level + 2)}<Wert ${attrs.join(" ")}/>`);
      lines.push(`${indent(level + 1)}</Werte>`);
    }
  }
  lines.push(`${indent(level)}</${tag}>`);
  return lines;
}

function serializeVnList(
  tag: string,
  list: unknown[] | undefined,
  level: number
): string[] {
  if (!list?.length) return [];
  const lines: string[] = [`${indent(level)}<${tag}>`];
  for (const v of list) {
    const vo = typeof v === "string" ? { id: v } : (v as Record<string, unknown>);
    if (!vo.id) continue;
    if (vo.except) {
      lines.push(
        `${indent(level + 1)}<VorNachteil Ausser="${esc(String(vo.except))}">${esc(String(vo.id))}</VorNachteil>`
      );
    } else {
      lines.push(
        `${indent(level + 1)}<VorNachteil>${esc(String(vo.id))}</VorNachteil>`
      );
    }
  }
  lines.push(`${indent(level)}</${tag}>`);
  return lines;
}

function serializeTalentBoni(
  bonuses: unknown[] | undefined,
  level: number
): string[] {
  if (!bonuses?.length) return [];
  const lines: string[] = [`${indent(level)}<TalentBoni>`];
  for (const b of bonuses) {
    const bo = b as Record<string, unknown>;
    if (bo.type === "ancient_language") {
      lines.push(`${indent(level + 1)}<AlteSpracheBosparanoUrTulamidya>`);
      const bonusesArr = (bo.bonuses as number[]) || [Number(bo.bonus ?? 0)];
      for (const n of bonusesArr) {
        lines.push(`${indent(level + 2)}<Bonus>${n}</Bonus>`);
      }
      lines.push(`${indent(level + 1)}</AlteSpracheBosparanoUrTulamidya>`);
      continue;
    }
    if (bo.type === "free") {
      const talents = (bo.talents as string[]) || [];
      lines.push(
        `${indent(level + 1)}<Frei Bonus="${Number(bo.points ?? bo.bonus ?? 0)}">`
      );
      lines.push(`${indent(level + 2)}<TalentListe>`);
      for (const t of talents) {
        if ((TALENT_LIST_MARKER_TAGS as readonly string[]).includes(t)) {
          lines.push(`${indent(level + 3)}<${t}/>`);
        } else {
          lines.push(`${indent(level + 3)}<Talent>${esc(t)}</Talent>`);
        }
      }
      lines.push(`${indent(level + 2)}</TalentListe>`);
      lines.push(`${indent(level + 1)}</Frei>`);
      continue;
    }
    // fixed
    const talents = (bo.talents as string[]) || [];
    const festAttrs: string[] = [];
    if (bo.lead) festAttrs.push(`Leittalent="true"`);
    if (bo.typ) festAttrs.push(`Typ="${esc(String(bo.typ))}"`);
    const attrStr = festAttrs.length ? ` ${festAttrs.join(" ")}` : "";
    lines.push(`${indent(level + 1)}<Fest${attrStr}>`);
    lines.push(`${indent(level + 2)}<TalentListe>`);
    for (const t of talents) {
      if ((TALENT_LIST_MARKER_TAGS as readonly string[]).includes(t)) {
        lines.push(`${indent(level + 3)}<${t}/>`);
      } else {
        lines.push(`${indent(level + 3)}<Talent>${esc(t)}</Talent>`);
      }
    }
    lines.push(`${indent(level + 2)}</TalentListe>`);
    const bonusesArr = (bo.bonuses as number[]) || [Number(bo.bonus ?? 0)];
    for (const n of bonusesArr) {
      lines.push(`${indent(level + 2)}<Bonus>${n}</Bonus>`);
    }
    lines.push(`${indent(level + 1)}</Fest>`);
  }
  lines.push(`${indent(level)}</TalentBoni>`);
  return lines;
}

function serializeSfBoni(
  bonuses: unknown[] | undefined,
  level: number
): string[] {
  if (!bonuses?.length) return [];
  const lines: string[] = [`${indent(level)}<SonderfertigkeitBoni>`];
  for (const b of bonuses) {
    const bo = b as Record<string, unknown>;
    if (bo.kind === "terrain_knowledge") {
      lines.push(`${indent(level + 1)}<Gelaendekunde/>`);
      continue;
    }
    if (bo.open && Array.isArray(bo.choices)) {
      lines.push(`${indent(level + 1)}<Werte>`);
      for (const c of bo.choices as Array<Record<string, unknown>>) {
        const attrs = [`Sonderfertigkeit="${esc(String(c.id))}"`];
        if (c.variant) attrs.push(`Variante="${esc(String(c.variant))}"`);
        if (c.talent) attrs.push(`Talent="${esc(String(c.talent))}"`);
        lines.push(`${indent(level + 2)}<Wert ${attrs.join(" ")}/>`);
      }
      lines.push(`${indent(level + 1)}</Werte>`);
    } else if (bo.id) {
      lines.push(`${indent(level + 1)}<Werte>`);
      const attrs = [`Sonderfertigkeit="${esc(String(bo.id))}"`];
      if (bo.variant) attrs.push(`Variante="${esc(String(bo.variant))}"`);
      if (bo.talent) attrs.push(`Talent="${esc(String(bo.talent))}"`);
      lines.push(`${indent(level + 2)}<Wert ${attrs.join(" ")}/>`);
      lines.push(`${indent(level + 1)}</Werte>`);
    }
  }
  lines.push(`${indent(level)}</SonderfertigkeitBoni>`);
  return lines;
}

function serializeVerbilligteSf(
  list: unknown[] | undefined,
  level: number
): string[] {
  if (!list?.length) return [];
  const lines: string[] = [
    `${indent(level)}<VerbilligteSonderfertigkeiten>`,
  ];
  for (const s of list) {
    const so = s as Record<string, unknown>;
    if (so.kind === "terrain_knowledge") {
      lines.push(`${indent(level + 1)}<Gelaendekunde/>`);
      continue;
    }
    if (!so.id) continue;
    const attrs = [`Sonderfertigkeit="${esc(String(so.id))}"`];
    if (so.variant) attrs.push(`Variante="${esc(String(so.variant))}"`);
    lines.push(
      `${indent(level + 1)}<Sonderfertigkeit ${attrs.join(" ")}/>`
    );
  }
  lines.push(`${indent(level)}</VerbilligteSonderfertigkeiten>`);
  return lines;
}

function serializeVerbilligteVarianten(
  list: unknown[] | undefined,
  level: number
): string[] {
  if (!list?.length) return [];
  const lines: string[] = [`${indent(level)}<VerbilligteVarianten>`];
  for (const v of list) {
    const vo = v as Record<string, unknown>;
    if (!vo.id) continue;
    const attrs = [`Sonderfertigkeit="${esc(String(vo.id))}"`];
    if (vo.variant) attrs.push(`Variante="${esc(String(vo.variant))}"`);
    if (vo.description)
      attrs.push(`Beschreibung="${esc(String(vo.description))}"`);
    lines.push(`${indent(level + 1)}<Variante ${attrs.join(" ")}/>`);
  }
  lines.push(`${indent(level)}</VerbilligteVarianten>`);
  return lines;
}

function serializeSpellBoni(
  bonuses: unknown[] | undefined,
  level: number
): string[] {
  if (!bonuses?.length) return [];
  const lines: string[] = [`${indent(level)}<ZauberBoni>`];
  for (const z of bonuses) {
    const zo = z as Record<string, unknown>;
    if (!zo.id) continue;
    const attrs = [
      `Zauber="${esc(String(zo.id))}"`,
      `Bonus="${Number(zo.bonus ?? 0)}"`,
      `Hauszauber="${zo.house ? "true" : "false"}"`,
    ];
    if (zo.variant) attrs.push(`Variante="${esc(String(zo.variant))}"`);
    lines.push(`${indent(level + 1)}<ZauberBonus ${attrs.join(" ")}/>`);
  }
  lines.push(`${indent(level)}</ZauberBoni>`);
  return lines;
}

function serializeColorTable(
  tag: string,
  entries: unknown[] | undefined,
  level: number
): string[] {
  if (!entries?.length) return [];
  const lines: string[] = [`${indent(level)}<${tag}>`];
  for (const e of entries) {
    const eo = e as Record<string, unknown>;
    lines.push(
      `${indent(level + 1)}<Eintrag von="${eo.from}" bis="${eo.to}" Ergebnis="${esc(String(eo.result ?? ""))}"/>`
    );
  }
  lines.push(`${indent(level)}</${tag}>`);
  return lines;
}

function serializeProfessions(
  professions: Record<string, unknown> | undefined,
  level: number
): string[] {
  if (!professions) return [];
  const mode = String(professions.mode || "all");
  const exclude = (professions.exclude as string[]) || [];
  const include = (professions.include as string[]) || [];
  if (mode === "all" && !exclude.length && !include.length) return [];
  const lines: string[] = [`${indent(level)}<Professionen>`];
  if (mode === "all_except") {
    lines.push(`${indent(level + 1)}<AlleAusser>`);
    for (const p of exclude) {
      lines.push(`${indent(level + 2)}<Profession>${esc(p)}</Profession>`);
    }
    lines.push(`${indent(level + 1)}</AlleAusser>`);
  } else if (mode === "none_except") {
    lines.push(`${indent(level + 1)}<KeineAusser>`);
    for (const p of include) {
      lines.push(`${indent(level + 2)}<Profession>${esc(p)}</Profession>`);
    }
    lines.push(`${indent(level + 1)}</KeineAusser>`);
  } else {
    for (const p of include) {
      lines.push(`${indent(level + 1)}<Profession>${esc(p)}</Profession>`);
    }
  }
  lines.push(`${indent(level)}</Professionen>`);
  return lines;
}

function serializeVoraussetzungen(item: CatalogItem, level: number): string[] {
  const mins = (item.attribute_minimums as Record<string, number>) || {};
  const soMin = item.so_min as number | undefined;
  const soMax = item.so_max as number | undefined;
  const minEntries = Object.entries(mins).filter(([, v]) => v > 0);
  const hasSo =
    (soMin != null && soMin !== 0) || (soMax != null && soMax !== 13);
  if (!minEntries.length && !hasSo) return [];

  const lines: string[] = [`${indent(level)}<Voraussetzungen>`];
  // Group attributes by minimum level (stable ATTR_CODES order within a level)
  const ATTR_ORDER = ["CO", "CL", "IN", "CH", "DE", "AG", "CN", "ST", "SO"];
  const byLevel = new Map<number, string[]>();
  const sortedMins = [...minEntries].sort(
    (a, b) => ATTR_ORDER.indexOf(a[0]) - ATTR_ORDER.indexOf(b[0])
  );
  for (const [code, levelVal] of sortedMins) {
    const list = byLevel.get(levelVal) || [];
    list.push(code);
    byLevel.set(levelVal, list);
  }
  for (const [levelVal, codes] of byLevel) {
    lines.push(
      `${indent(level + 1)}<Mindeststufe Mindeststufe="${levelVal}">`
    );
    for (const code of codes) {
      const ger =
        ATTR_TO_GERMAN[code as AttrCodeWithSo] ||
        (code.startsWith("Eigenschaft.") ? code : `Eigenschaft.${code}`);
      lines.push(
        `${indent(level + 2)}<Eigenschaft>${esc(ger)}</Eigenschaft>`
      );
    }
    lines.push(`${indent(level + 1)}</Mindeststufe>`);
  }
  if (hasSo || soMin != null || soMax != null) {
    const attrs = [
      `Mindeststufe="${soMin ?? 0}"`,
      `Hoechststufe="${soMax ?? 13}"`,
    ];
    lines.push(`${indent(level + 1)}<So ${attrs.join(" ")}/>`);
  }
  lines.push(`${indent(level)}</Voraussetzungen>`);
  return lines;
}

function serializeSpecialPossessions(
  possessions: unknown[] | undefined,
  level: number
): string[] {
  if (!possessions?.length) return [];
  const lines: string[] = [`${indent(level)}<BesondererBesitz>`];
  for (const p of possessions) {
    lines.push(`${indent(level + 1)}<Besitz>${esc(String(p))}</Besitz>`);
  }
  lines.push(`${indent(level)}</BesondererBesitz>`);
  return lines;
}

/** Serialize one catalog entry back to a single Charbuilder baustein XML document. */
export function serializeCharbuilderBausteinXml(
  category: CharbuilderBausteinCategory,
  item: CatalogItem
): string {
  const root = ROOT_TAG[category];
  const lines: string[] = [];

  if (category === "cultures" && item.name_factory) {
    lines.push(`<${root} NameFactory="${esc(String(item.name_factory))}">`);
  } else {
    lines.push(`<${root}>`);
  }

  lines.push(`${indent(1)}<Id>${esc(item.id)}</Id>`);
  lines.push(...serializeKosten(item, 1));
  if (category === "professions") {
    lines.push(...serializeVoraussetzungen(item, 1));
  }
  lines.push(...serializeMods(item, 1));
  lines.push(
    ...serializeVnBoni(
      "VorteilBoni",
      item.advantage_bonuses as unknown[],
      1
    )
  );
  lines.push(
    ...serializeVnBoni(
      "NachteilBoni",
      item.disadvantage_bonuses as unknown[],
      1
    )
  );
  lines.push(
    ...serializeVnList(
      "EmpfohleneVorNachteile",
      item.recommended_advantages_disadvantages as unknown[],
      1
    )
  );
  lines.push(
    ...serializeVnList(
      "UngeeigneteVorNachteile",
      item.unsuitable_advantages_disadvantages as unknown[],
      1
    )
  );
  lines.push(
    ...serializeTalentBoni(item.talent_bonuses as unknown[], 1)
  );

  if (category === "races") {
    const leads = (item.lead_talents as string[]) || [];
    if (leads.length) {
      lines.push(`${indent(1)}<Leittalente>`);
      for (const t of leads) {
        lines.push(`${indent(2)}<Talent>${esc(t)}</Talent>`);
      }
      lines.push(`${indent(1)}</Leittalente>`);
    }
    const age = item.age as { base?: number; dice?: number } | null | undefined;
    if (age) {
      lines.push(
        `${indent(1)}<Alter Basis="${age.base ?? 0}" Wuerfel="${age.dice ?? 0}"/>`
      );
    }
    lines.push(
      ...serializeColorTable("Haarfarben", item.hair_colors as unknown[], 1)
    );
    lines.push(
      ...serializeColorTable("Augenfarben", item.eye_colors as unknown[], 1)
    );
    const height = item.height as
      | { base?: number; w6?: number; w20?: number }
      | null
      | undefined;
    if (height) {
      lines.push(
        `${indent(1)}<Koerpergroesse Basis="${height.base ?? 0}" W6="${height.w6 ?? 0}" W20="${height.w20 ?? 0}"/>`
      );
    }
    if (item.weight_factor != null) {
      lines.push(
        `${indent(1)}<Gewicht>${Number(item.weight_factor)}</Gewicht>`
      );
    }
    const cultures = (item.allowed_cultures as string[]) || [];
    if (cultures.length) {
      lines.push(`${indent(1)}<Kulturen>`);
      for (const c of cultures) {
        lines.push(`${indent(2)}<Kultur>${esc(c)}</Kultur>`);
      }
      lines.push(`${indent(1)}</Kulturen>`);
    }
    lines.push(
      ...serializeSfBoni(item.special_ability_bonuses as unknown[], 1)
    );
    lines.push(
      ...serializeVerbilligteSf(
        item.discounted_special_abilities as unknown[],
        1
      )
    );
  }

  if (category === "cultures") {
    lines.push(
      ...serializeSfBoni(item.special_ability_bonuses as unknown[], 1)
    );
    lines.push(
      ...serializeVerbilligteSf(
        item.discounted_special_abilities as unknown[],
        1
      )
    );
    lines.push(
      ...serializeVerbilligteVarianten(
        item.discounted_special_ability_variants as unknown[],
        1
      )
    );
    lines.push(...serializeSpellBoni(item.spell_bonuses as unknown[], 1));
    if (item.lead_spell_count != null && Number(item.lead_spell_count) > 0) {
      lines.push(
        `${indent(1)}<Leitzauber>${Number(item.lead_spell_count)}</Leitzauber>`
      );
    }
    if (item.mother_tongue) {
      lines.push(
        `${indent(1)}<Muttersprache>${esc(String(item.mother_tongue))}</Muttersprache>`
      );
    }
    const seconds = (item.second_languages as string[]) || [];
    if (seconds.length) {
      lines.push(`${indent(1)}<Zweitsprachen>`);
      for (const s of seconds) {
        lines.push(`${indent(2)}<Sprache>${esc(s)}</Sprache>`);
      }
      lines.push(`${indent(1)}</Zweitsprachen>`);
    }
    lines.push(
      ...serializeProfessions(
        item.professions as Record<string, unknown> | undefined,
        1
      )
    );
  }

  if (category === "professions") {
    lines.push(...serializeSpellBoni(item.spell_bonuses as unknown[], 1));
    lines.push(
      ...serializeSfBoni(item.special_ability_bonuses as unknown[], 1)
    );
    lines.push(
      ...serializeVerbilligteSf(
        item.discounted_special_abilities as unknown[],
        1
      )
    );
    lines.push(
      ...serializeVerbilligteVarianten(
        item.discounted_special_ability_variants as unknown[],
        1
      )
    );
    lines.push(
      ...serializeSpecialPossessions(
        item.special_possessions as unknown[],
        1
      )
    );
  }

  lines.push(`</${root}>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${lines.join("\n")}\n`;
}

/** Derive a `.ras` / `.kul` / `.pro` filename from the catalog item id. */
export function charbuilderBausteinFilename(
  category: CharbuilderBausteinCategory,
  item: CatalogItem
): string {
  const id = item.id || "Unknown";
  const seg = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
  const safe = seg.replace(/[^\w.-]+/g, "_") || "Unknown";
  return `${safe}.${FILE_EXT[category]}`;
}

/** Accept attribute for the file input for a baustein category. */
export function charbuilderBausteinAccept(
  category: CharbuilderBausteinCategory
): string {
  const ext = FILE_EXT[category];
  return `.${ext},.xml,application/xml,text/xml`;
}

export function downloadBausteinXml(
  category: CharbuilderBausteinCategory,
  item: CatalogItem,
  filename?: string
): void {
  const xml = serializeCharbuilderBausteinXml(category, item);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || charbuilderBausteinFilename(category, item);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
