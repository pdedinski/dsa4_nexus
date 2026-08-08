/**
 * One-shot extractor: Java Chargen XML + Lokalisierung + Java static catalogs
 * -> lib/chargen/data/*.json
 *
 * Usage: node scripts/chargen-extract/extract-all.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { XMLParser } from "fast-xml-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CHARGEN = "D:/Work/TDE/Chargen_decompile";
const RES = path.join(CHARGEN, "resources/de/bernhardjung/dsaprogramm");
const SRC = path.join(CHARGEN, "sources/de/bernhardjung/dsaprogramm");
const OUT = path.join(ROOT, "lib/chargen/data");

const ATTR_MAP = {
  "Eigenschaft.Mut": "CO",
  "Eigenschaft.Klugheit": "CL",
  "Eigenschaft.Intuition": "IN",
  "Eigenschaft.Charisma": "CH",
  "Eigenschaft.Fingerfertigkeit": "DE",
  "Eigenschaft.Gewandtheit": "AG",
  "Eigenschaft.Konstitution": "CN",
  "Eigenschaft.Koerperkraft": "ST",
  "Eigenschaft.Sozialstatus": "SO",
  MU: "CO",
  KL: "CL",
  IN: "IN",
  CH: "CH",
  FF: "DE",
  GE: "AG",
  KO: "CN",
  KK: "ST",
  SO: "SO",
};

const BASIS_MAP = {
  "Basiswert.Lebensenergie": "VP",
  "Basiswert.Ausdauer": "EP",
  "Basiswert.Magieresistenz": "RM",
  "Basiswert.Astralenergie": "ASP",
  "Basiswert.Wundschwelle": "WT",
  "Basiswert.Attacke": "baseAT",
  "Basiswert.Parade": "basePA",
  "Basiswert.Fernkampf": "baseBRV",
  "Basiswert.Initiative": "baseINI",
};

const GROUP_MAP = {
  KOERPER: "physical",
  KAMPF: "combat",
  GESELLSCHAFT: "social",
  NATUR: "nature",
  WISSEN: "knowledge",
  SPRACHEN: "languages",
  SCHRIFTEN: "scripts",
  HANDWERK: "craft",
  GABEN: "gifts",
  RITUALKENNTNIS: "ritual_knowledge",
  ALLGEMEIN: "general",
  MAGISCHE: "magical",
  ZAUBER: "spells",
  TALENTSPEZIALISIERUNG: "talent_specialization",
  WAFFENSPEZIALISIERUNG: "weapon_specialization",
};

const SF_EXPAND_TEMPLATES = {
  "Sonderfertigkeit.Talentspezialisierung": "talent_specialization",
  "Sonderfertigkeit.Waffenspezialisierung": "weapon_specialization",
  "Sonderfertigkeit.Scharfschuetze": "sharpshooter",
};

const SF_VARIANT_SOURCE = {
  "Sonderfertigkeit.Kulturkunde": "kulturkunde",
  "Sonderfertigkeit.Ortskenntnis": "free_text",
  "Sonderfertigkeit.RuestungsgewoehnungI": "armor",
  "Sonderfertigkeit.Repraesentation": "representation",
};

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function writeJson(name, data) {
  ensureDir(OUT);
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Wrote ${name} (${Array.isArray(data) ? data.length : Object.keys(data).length} entries)`);
}

function parseProperties(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const eq = line.indexOf("=");
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1);
    // unescape unicode
    val = val.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    );
    map.set(key, val);
  }
  return map;
}

function namesFor(id, en, de) {
  if (!id) return { name: "Unknown", german_name: "Unbekannt" };
  const enName = en.get(`${id}.Name`) || en.get(id) || id.split(".").pop();
  const deName = de.get(`${id}.Name`) || de.get(id) || id.split(".").pop();
  return { name: enName, german_name: deName };
}

function asArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function textOf(v) {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in v) return String(v["#text"]);
  return null;
}

function parseXmlFile(filePath) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    isArray: (name, jpath) => {
      // Never array-ify the document root element
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
        "Waffe",
        "Fernwaffe",
        "Ruestung",
        "Schild",
        "TalentListe",
        "Sprache",
        "Wert",
        "NameFactory",
        "Namenliste",
        "Format",
        "Name",
      ].includes(name);
    },
  });
  return parser.parse(fs.readFileSync(filePath, "utf8"));
}

const TALENT_LIST_MARKER_TAGS = [
  "Fremdsprachen",
  "Muttersprache",
  "NichtMuttersprache",
  "SchriftenMuttersprache",
];

/** Parse TalentListe: <Talent>…</Talent> and markers like <Fremdsprachen/>. */
function extractTalentListeIds(festOrFrei) {
  const talents = [];
  for (const tl of asArray(festOrFrei.TalentListe)) {
    if (tl == null) continue;
    if (typeof tl === "string") {
      if (tl) talents.push(tl);
      continue;
    }
    for (const t of asArray(tl.Talent)) {
      const id = textOf(t);
      if (id) talents.push(id);
    }
    for (const marker of TALENT_LIST_MARKER_TAGS) {
      if (Object.prototype.hasOwnProperty.call(tl, marker)) {
        talents.push(marker);
      }
    }
  }
  const direct = asArray(festOrFrei.Talent).map(textOf).filter(Boolean);
  return talents.length ? talents : direct;
}

function extractTalentBoni(node) {
  if (!node) return [];
  const out = [];
  for (const fest of asArray(node.Fest)) {
    const list = extractTalentListeIds(fest);
    // Multiple <Bonus> children = multiple ranks to assign among the talent list
    let bonuses = asArray(fest.Bonus)
      .map((b) => Number(textOf(b) ?? b))
      .filter((n) => Number.isFinite(n));
    if (!bonuses.length && fest.Bonus != null) {
      bonuses = [Number(fest.Bonus)];
    }
    const isMarker =
      list.length === 1 && TALENT_LIST_MARKER_TAGS.includes(list[0]);
    out.push({
      type: "fixed",
      bonus: bonuses[0] ?? 0,
      bonuses,
      talents: list,
      open: list.length > 1 || isMarker,
      // Java FactoryTalentBoniIn: presence of Leittalent attr → true
      lead:
        fest["@_Leittalent"] != null &&
        String(fest["@_Leittalent"]).toLowerCase() !== "false",
      // Java TalentbonusTyp.ENTDECKER when Fest Typ="Entdecker"
      typ: fest["@_Typ"] ? String(fest["@_Typ"]) : undefined,
    });
  }
  for (const frei of asArray(node.Frei)) {
    const list = extractTalentListeIds(frei);
    // Java uses attribute Bonus="N" on <Frei>, not a child element
    const points = Number(
      frei["@_Bonus"] ?? frei.Bonus ?? frei.Punkte ?? 0
    );
    out.push({
      type: "free",
      points,
      bonus: points,
      talents: list,
      open: true,
    });
  }
  // Java TalentbonusFestAlteSprache — auto Bosparano/UrTulamidya by mother tongue
  for (const alte of asArray(node.AlteSpracheBosparanoUrTulamidya)) {
    let bonuses = asArray(alte.Bonus)
      .map((b) => Number(textOf(b) ?? b))
      .filter((n) => Number.isFinite(n));
    if (!bonuses.length && alte.Bonus != null) {
      bonuses = [Number(alte.Bonus)];
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

function extractSfBoni(node) {
  if (!node) return [];
  const out = [];
  // Preserve sibling order: each <Werte> is one bonus (auto if 1 option, open if many);
  // <Gelaendekunde/> is an open pick among all topography SFs (Java SonderfertigkeitBonus.GELAENDEKUNDE).
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

  const parseWert = (w) => {
    if (!w) return null;
    if (typeof w === "string") return { id: w, variant: null, talent: undefined };
    const id = w["@_Sonderfertigkeit"] || textOf(w);
    if (!id) return null;
    return {
      id,
      variant: w["@_Variante"] || null,
      talent: w["@_Talent"] || undefined,
    };
  };

  const blocks = asArray(node.Werte);
  for (const block of blocks) {
    const werte = asArray(block?.Wert ?? block)
      .map(parseWert)
      .filter(Boolean);
    if (!werte.length) continue;
    if (werte.length === 1) {
      out.push({ ...werte[0], open: false });
    } else {
      out.push({
        open: true,
        choices: werte,
      });
    }
  }

  // Flat <Wert> without <Werte> wrapper (legacy)
  if (!blocks.length) {
    for (const w of asArray(node.Wert).map(parseWert).filter(Boolean)) {
      out.push({ ...w, open: false });
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

/** Culture/profession <ZauberBoni><ZauberBonus Zauber=… Bonus=… Hauszauber=…/> */
function extractSpellBoni(node) {
  if (!node) return [];
  return asArray(node.ZauberBonus ?? node)
    .map((z) => {
      if (typeof z === "string") {
        return { id: z, bonus: 0, house: false, variant: null };
      }
      const id = z["@_Zauber"] || textOf(z);
      if (!id) return null;
      return {
        id,
        bonus: Number(z["@_Bonus"] ?? textOf(z.Bonus) ?? 0) || 0,
        house:
          String(z["@_Hauszauber"] ?? "false").toLowerCase() === "true",
        variant: z["@_Variante"] || null,
      };
    })
    .filter(Boolean);
}

function extractVerbilligteSf(node) {
  if (!node) return [];
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
  const out = [];
  for (const s of asArray(node.Sonderfertigkeit)) {
    if (typeof s === "string") {
      out.push({ id: s });
      continue;
    }
    const id = s["@_Sonderfertigkeit"] || textOf(s);
    if (id) out.push({ id, variant: s["@_Variante"] || null });
  }
  // Java VerbilligteSonderfertigkeit.GELAENDEKUNDE — open discounted pick
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

/** Java <VerbilligteVarianten><Variante Sonderfertigkeit=… Variante=…/> */
function extractVerbilligteVarianten(node) {
  if (!node) return [];
  return asArray(node.Variante)
    .map((v) => {
      if (!v || typeof v === "string") return null;
      const id = v["@_Sonderfertigkeit"] || textOf(v);
      if (!id) return null;
      return {
        id,
        variant: v["@_Variante"] || null,
        description: v["@_Beschreibung"] || null,
      };
    })
    .filter(Boolean);
}

function extractMods(node) {
  const attribute_modifiers = {};
  const derived_modifiers = {};
  if (!node) return { attribute_modifiers, derived_modifiers };
  for (const m of asArray(node.EigenschaftModifikation)) {
    const id = m["@_Eigenschaft"] || textOf(m.Eigenschaft);
    const code = ATTR_MAP[id] || id;
    attribute_modifiers[code] = Number(m["@_Modifikation"] ?? m.Modifikation ?? 0);
  }
  for (const m of asArray(node.BasiswertModifikation)) {
    const id = m["@_Basiswert"] || textOf(m.Basiswert);
    const code = BASIS_MAP[id] || id;
    derived_modifiers[code] = Number(m["@_Modifikation"] ?? m.Modifikation ?? 0);
  }
  return { attribute_modifiers, derived_modifiers };
}

function extractVnList(node) {
  return asArray(node)
    .map((v) => {
      if (typeof v === "string") return { id: v };
      const id = textOf(v);
      const except = v["@_Ausser"];
      return except ? { id, except } : { id };
    })
    .filter((x) => x.id);
}

function extractVnBoni(node) {
  if (!node) return [];
  const out = [];
  for (const werte of asArray(node.Werte ?? node)) {
    const werteNode = werte?.Wert != null ? werte : { Wert: werte };
    for (const w of asArray(werteNode.Wert)) {
      if (!w) continue;
      if (typeof w === "string") {
        out.push({ id: w });
        continue;
      }
      const id = w["@_VorNachteil"] || textOf(w);
      if (!id) continue;
      out.push({
        id,
        variant: w["@_Variante"] || null,
        rating: w["@_Stufe"] != null ? Number(w["@_Stufe"]) : null,
        open: false,
      });
    }
    // Multiple <Wert> under one <Werte> = open choice among them
    const ids = asArray(werteNode.Wert)
      .map((w) =>
        typeof w === "string" ? w : w?.["@_VorNachteil"] || textOf(w)
      )
      .filter(Boolean);
    if (ids.length > 1) {
      // Replace last N single entries with one open choice
      out.splice(out.length - ids.length, ids.length, {
        id: null,
        choices: ids.map((id, i) => {
          const w = asArray(werteNode.Wert)[i];
          return {
            id,
            variant:
              typeof w === "object" ? w["@_Variante"] || null : null,
            rating:
              typeof w === "object" && w["@_Stufe"] != null
                ? Number(w["@_Stufe"])
                : null,
          };
        }),
        open: true,
      });
    }
  }
  return out;
}

function extractProfessions(node) {
  if (!node) return { mode: "all", exclude: [], include: [] };
  if (node.AlleAusser) {
    return {
      mode: "all_except",
      exclude: asArray(node.AlleAusser.Profession).map(textOf).filter(Boolean),
      include: [],
    };
  }
  // Java: AlleVon = allow-list. Legacy KeineAusser treated the same.
  if (node.AlleVon || node.KeineAusser) {
    const allow = node.AlleVon || node.KeineAusser;
    return {
      mode: "list",
      exclude: [],
      include: asArray(allow.Profession).map(textOf).filter(Boolean),
    };
  }
  return {
    mode: "list",
    exclude: [],
    include: asArray(node.Profession).map(textOf).filter(Boolean),
  };
}

function extractBausteine(dir, rootTag, en, de) {
  const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
  const items = [];
  for (const file of files) {
    const parsed = parseXmlFile(path.join(dir, file));
    let root = parsed[rootTag];
    if (Array.isArray(root)) root = root[0];
    if (!root) {
      console.warn(`No root ${rootTag} in ${file}`);
      continue;
    }
    const id = textOf(root.Id);
    if (!id) {
      console.warn(`Skipping ${file}: missing Id`);
      continue;
    }
    const kosten = root.Kosten;
    let gp = 0;
    let gp_cost_by_race = undefined;
    if (kosten?.Fest != null) {
      gp = Number(kosten.Fest);
    } else if (kosten?.KostenRasse) {
      const kr = kosten.KostenRasse;
      if (kr.Normal != null) gp = Number(textOf(kr.Normal) ?? kr.Normal) || 0;
      const byRace = {};
      for (const r of asArray(kr.Rasse)) {
        const raceId = r["@_Rasse"] || textOf(r);
        const cost = Number(r["@_Kosten"] ?? textOf(r.Kosten) ?? 0);
        if (raceId && Number.isFinite(cost)) byRace[raceId] = cost;
      }
      if (Object.keys(byRace).length) gp_cost_by_race = byRace;
    } else if (kosten?.["#text"] != null) {
      gp = Number(kosten["#text"]);
    }
    const mods = extractMods(root.Modifikationen);
    const item = {
      id,
      ...namesFor(id, en, de),
      gp_cost: gp,
      ...(gp_cost_by_race ? { gp_cost_by_race } : {}),
      ...mods,
      talent_bonuses: extractTalentBoni(root.TalentBoni),
      // Java FactoryLeittalenteIn — race/culture (profession usually empty)
      lead_talents: asArray(root.Leittalente?.Talent)
        .map(textOf)
        .filter(Boolean),
      advantage_bonuses: extractVnBoni(root.VorteilBoni),
      disadvantage_bonuses: extractVnBoni(root.NachteilBoni),
      recommended_advantages_disadvantages: extractVnList(
        root.EmpfohleneVorNachteile?.VorNachteil
      ),
      unsuitable_advantages_disadvantages: extractVnList(
        root.UngeeigneteVorNachteile?.VorNachteil
      ),
      source: "builtin",
      _file: file,
    };
    if (rootTag === "Rasse") {
      item.allowed_cultures = asArray(root.Kulturen?.Kultur)
        .map(textOf)
        .filter(Boolean);
      item.age = root.Alter
        ? {
            base: Number(root.Alter["@_Basis"] ?? 0),
            dice: Number(root.Alter["@_Wuerfel"] ?? 0),
          }
        : null;
      item.height = root.Koerpergroesse
        ? {
            base: Number(root.Koerpergroesse["@_Basis"] ?? 0),
            w6: Number(root.Koerpergroesse["@_W6"] ?? 0),
            w20: Number(root.Koerpergroesse["@_W20"] ?? 0),
          }
        : null;
      item.weight_factor = root.Gewicht != null ? Number(textOf(root.Gewicht)) : null;
      item.hair_colors = asArray(root.Haarfarben?.Eintrag).map((e) => ({
        from: Number(e["@_von"]),
        to: Number(e["@_bis"]),
        result: e["@_Ergebnis"],
      }));
      item.eye_colors = asArray(root.Augenfarben?.Eintrag).map((e) => ({
        from: Number(e["@_von"]),
        to: Number(e["@_bis"]),
        result: e["@_Ergebnis"],
      }));
    }
    if (rootTag === "Kultur") {
      item.mother_tongue = textOf(root.Muttersprache);
      item.second_languages = asArray(
        root.Zweitsprachen?.Sprache ??
          root.Zweitsprache?.Talent ??
          root.Zweitsprachen?.Talent
      )
        .map(textOf)
        .filter(Boolean);
      item.professions = extractProfessions(root.Professionen);
      item.name_factory = root["@_NameFactory"] || null;
      item.special_ability_bonuses = extractSfBoni(root.SonderfertigkeitBoni);
      item.discounted_special_abilities = extractVerbilligteSf(
        root.VerbilligteSonderfertigkeiten
      );
      item.discounted_special_ability_variants = extractVerbilligteVarianten(
        root.VerbilligteVarianten
      );
      item.special_abilities = item.special_ability_bonuses
        .filter((s) => s.id && !s.open)
        .map((s) => s.id);
      item.spell_bonuses = extractSpellBoni(root.ZauberBoni);
      item.spells = item.spell_bonuses.map((s) => s.id);
      item.lead_spell_count =
        root.Leitzauber != null ? Number(textOf(root.Leitzauber) ?? root.Leitzauber) || 0 : 0;
    }
    if (rootTag === "Profession") {
      item.requirements = [];
      item.special_ability_bonuses = extractSfBoni(root.SonderfertigkeitBoni);
      item.discounted_special_abilities = extractVerbilligteSf(
        root.VerbilligteSonderfertigkeiten
      );
      item.discounted_special_ability_variants = extractVerbilligteVarianten(
        root.VerbilligteVarianten
      );
      item.special_abilities = item.special_ability_bonuses
        .filter((s) => s.id && !s.open)
        .map((s) => s.id);
      item.spell_bonuses = extractSpellBoni(root.ZauberBoni);
      item.spells = item.spell_bonuses.map((s) => s.id);
      // <So …/> and <Mindeststufe> live under <Voraussetzungen>
      const vors = root.Voraussetzungen || {};
      const so = root.So || vors.So;
      if (so) {
        item.so_min =
          so["@_Mindeststufe"] != null ? Number(so["@_Mindeststufe"]) : 0;
        item.so_max =
          so["@_Hoechststufe"] != null ? Number(so["@_Hoechststufe"]) : 13;
      } else {
        item.so_min = 0;
        item.so_max = 13;
      }
      const attrMins = {};
      for (const m of asArray(vors.Mindeststufe ?? root.Mindeststufe)) {
        const level = Number(m["@_Mindeststufe"] ?? 0);
        for (const e of asArray(m.Eigenschaft)) {
          const raw = textOf(e);
          const code = ATTR_MAP[raw];
          if (code) attrMins[code] = Math.max(attrMins[code] || 0, level);
        }
      }
      item.attribute_minimums = attrMins;
    }
    if (rootTag === "Rasse") {
      item.special_ability_bonuses = extractSfBoni(root.SonderfertigkeitBoni);
      item.discounted_special_abilities = extractVerbilligteSf(
        root.VerbilligteSonderfertigkeiten
      );
    }
    items.push(item);
  }
  return items;
}

function extractMelee(en, de) {
  const parsed = parseXmlFile(
    path.join(RES, "daten/diverses/Nahkampfwaffen.xml")
  );
  return asArray(parsed.Waffen?.Waffe).map((w) => {
    const id = w["@_Id"];
    return {
      id,
      ...namesFor(id, en, de),
      talent: w["@_Talent"],
      talents: asArray(w.Talent).map(textOf).filter(Boolean),
      tp: w["@_Tp"],
      bf: Number(w["@_Bf"] ?? 0),
      ini: Number(w["@_Ini"] ?? 0),
      wm_at: Number(w["@_WmAt"] ?? 0),
      wm_pa: Number(w["@_WmPa"] ?? 0),
      dk_h: w["@_DkH"] === "true",
      dk_n: w["@_DkN"] === "true",
      dk_s: w["@_DkS"] === "true",
      damage_threshold: Number(w["@_Schwellenwert"] ?? 0),
      damage_step: Number(w["@_Schadensschritt"] ?? 0),
      source: "builtin",
    };
  });
}

function extractRanged(en, de) {
  const parsed = parseXmlFile(
    path.join(RES, "daten/diverses/Fernkampfwaffen.xml")
  );
  return asArray(parsed.Fernwaffen?.Fernwaffe).map((w) => {
    const id = w["@_Id"];
    return {
      id,
      ...namesFor(id, en, de),
      talent: w["@_Talent"],
      tp: w["@_Tp"],
      ranges: String(w["@_Reichtweiten"] || "")
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => !Number.isNaN(n)),
      tp_plus: String(w["@_TpPlus"] || "")
        .split(",")
        .map((x) => Number(x.trim())),
      weight: Number(w["@_Gewicht"] ?? 0),
      source: "builtin",
    };
  });
}

function extractArmor(en, de) {
  const parsed = parseXmlFile(path.join(RES, "daten/diverses/Ruestungen.xml"));
  return asArray(parsed.Ruestungen?.Ruestung).map((r) => {
    const id = r["@_Id"];
    return {
      id,
      ...namesFor(id, en, de),
      rs: Number(r["@_RS"] ?? 0),
      be: Number(r["@_BE"] ?? 0),
      price: Number(r["@_Preis"] ?? 0),
      weight: Number(r["@_Gewicht"] ?? 0),
      additional: r["@_Zusatzruestung"] === "true",
      min_torso_rs:
        r["@_MindestTorsoRs"] != null ? Number(r["@_MindestTorsoRs"]) : null,
      source: "builtin",
    };
  });
}

function extractShields(en, de) {
  const parsed = parseXmlFile(path.join(RES, "daten/diverses/Schilde.xml"));
  return asArray(parsed.Schilde?.Schild).map((s) => {
    const id = s["@_Id"];
    return {
      id,
      ...namesFor(id, en, de),
      type: s["@_Typ"],
      bf: Number(s["@_Bf"] ?? 0),
      ini: Number(s["@_Ini"] ?? 0),
      wm_at: Number(s["@_WmAt"] ?? 0),
      wm_pa: Number(s["@_WmPa"] ?? 0),
      source: "builtin",
    };
  });
}

function extractFromJavaConstructors(filePath, regex, mapper) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  const out = [];
  let m;
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  while ((m = re.exec(text))) {
    out.push(mapper(m));
  }
  return out;
}

function extractTalents(en, de) {
  const talentFile = path.join(SRC, "talente/Talent.java");
  const text = fs.readFileSync(talentFile, "utf8");
  const talents = [];
  const seen = new Set();

  function push(id, groupRaw, typeRaw, extra = {}) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    talents.push({
      id,
      ...namesFor(id, en, de),
      group: GROUP_MAP[groupRaw] || groupRaw.toLowerCase(),
      group_raw: groupRaw,
      type: (typeRaw || "SPEZIAL").toLowerCase(),
      is_basic: typeRaw === "BASIS",
      source: "builtin",
      ...extra,
    });
  }

  // Kampftechnik
  {
    const re =
      /=\s*new\s+Kampftechnik\(\s*"([^"]+)"\s*,\s*(?:Typ\.)?(\w+)\s*,\s*Kampftechnik\.Art\.(\w+)/g;
    let m;
    while ((m = re.exec(text)))
      push(m[1], "KAMPF", m[2], {
        combat: true,
        ranged: m[3] === "FERNKAMPF",
      });
  }
  // Sprache
  {
    const re = /=\s*new\s+Sprache\(\s*"([^"]+)"\s*\)/g;
    let m;
    while ((m = re.exec(text))) push(m[1], "SPRACHEN", "SPEZIAL", { language: true });
  }
  // Schrift
  {
    const re = /=\s*new\s+Schrift\(\s*"([^"]+)"\s*\)/g;
    let m;
    while ((m = re.exec(text))) push(m[1], "SCHRIFTEN", "SPEZIAL", { script: true });
  }
  // Generic Talent
  {
    const re =
      /=\s*new\s+Talent\(\s*"([^"]+)"\s*,\s*Talentgruppe\.(\w+)\s*,\s*(?:Typ\.)?(\w+)/g;
    let m;
    while ((m = re.exec(text))) push(m[1], m[2], m[3]);
  }

  // Field name → talent id (Kampftechnik / Talent / Sprache / Schrift)
  const fieldToId = new Map();
  {
    const decls = [
      /(\w+)\s*=\s*new\s+Kampftechnik\(\s*"([^"]+)"/g,
      /(\w+)\s*=\s*new\s+Talent\(\s*"([^"]+)"/g,
      /(\w+)\s*=\s*new\s+Sprache\(\s*"([^"]+)"\s*\)/g,
      /(\w+)\s*=\s*new\s+Schrift\(\s*"([^"]+)"\s*\)/g,
    ];
    for (const re of decls) {
      let m;
      while ((m = re.exec(text))) fieldToId.set(m[1], m[2]);
    }
  }

  // GARETHI.setKomplexitaet(18);
  {
    let m;
    const komplexe = /(\w+)\.setKomplexitaet\((\d+)\)/g;
    while ((m = komplexe.exec(text))) {
      const id = fieldToId.get(m[1]);
      if (!id) continue;
      const t = talents.find((x) => x.id === id);
      if (t) t.complexity = Number(m[2]);
    }
  }

  // FIELD.setSpezialisierungen("a", "b");
  {
    let m;
    const re =
      /(\w+)\.setSpezialisierungen\(\s*((?:"[^"]+"\s*,\s*)*"[^"]+")\s*\)/g;
    while ((m = re.exec(text))) {
      const id = fieldToId.get(m[1]);
      if (!id) continue;
      const t = talents.find((x) => x.id === id);
      if (!t) continue;
      t.specializations = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    }
  }

  // SKT column (steigerungsspalte) from initialisieren* helpers
  function setSkt(field, col) {
    const id = fieldToId.get(field);
    if (!id) return;
    const t = talents.find((x) => x.id === id);
    if (t) t.skt_column = Number(col);
  }
  {
    let m;
    const kampf = /initialisiereKampftechnik\(\s*(\w+)\s*,\s*(\d+)\s*,/g;
    while ((m = kampf.exec(text))) setSkt(m[1], m[2]);
    const wissen = /initialisierenWissen\(\s*(\w+)\s*,/g;
    while ((m = wissen.exec(text))) setSkt(m[1], 2);
    const sprache = /initialisiereSprache\(\s*(\w+)\s*,\s*(\d+)\s*,/g;
    while ((m = sprache.exec(text))) setSkt(m[1], m[2]);
    const schrift = /initialisiereSchrift\(\s*(\w+)\s*,\s*(\d+)\s*,/g;
    while ((m = schrift.exec(text))) setSkt(m[1], m[2]);
    // initialisieren(FIELD, Kosten.X, COL, …) or initialisieren(FIELD, COL, …)
    const initKosten =
      /initialisieren\(\s*(\w+)\s*,\s*Kosten\.\w+\s*,\s*(\d+)\s*,/g;
    while ((m = initKosten.exec(text))) setSkt(m[1], m[2]);
    const initCol = /initialisieren\(\s*(\w+)\s*,\s*(\d+)\s*,\s*Eigenschaft\./g;
    while ((m = initCol.exec(text))) setSkt(m[1], m[2]);
  }

  for (const [key, val] of en) {
    if (!key.startsWith("Talent.") || !key.endsWith(".Name")) continue;
    const id = key.slice(0, -".Name".length);
    if (seen.has(id)) continue;
    push(id, "UNKNOWN", "SPEZIAL");
    const t = talents[talents.length - 1];
    t.name = val;
    t.german_name = de.get(key) || id.split(".").pop();
  }
  return talents;
}

function extractSpells(en, de) {
  const file = path.join(SRC, "zauber/Zauber.java");
  const text = fs.readFileSync(file, "utf8");
  const spells = [];
  const re =
    /new\s+Zauber\(\s*"([^"]+)"\s*,\s*Zaubergruppe\.(\w+)\s*,\s*(\d+)\s*,\s*Arrays\.asList\(([^)]*)\)\s*,\s*Arrays\.asList\(([^)]*)\)\s*,\s*([^)]+)\)/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(text))) {
    const id = m[1];
    seen.add(id);
    const reps = m[4]
      .split(",")
      .map((s) => s.trim().replace(/^Repraesentation\./, ""))
      .filter(Boolean);
    const attrs = m[6]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("Eigenschaft."))
      .map((s) => ATTR_MAP[s] || s);
    spells.push({
      id,
      ...namesFor(id, en, de),
      group: GROUP_MAP[m[2]] || m[2].toLowerCase(),
      complexity: Number(m[3]),
      representations: reps,
      test_attributes: attrs.slice(0, 3),
      source: "builtin",
    });
  }
  for (const [key, val] of en) {
    if (!key.startsWith("Zauber.") || !key.endsWith(".Name")) continue;
    const id = key.slice(0, -".Name".length);
    if (seen.has(id)) continue;
    spells.push({
      id,
      name: val,
      german_name: de.get(key) || id.split(".").pop(),
      group: "spells",
      complexity: 0,
      representations: [],
      test_attributes: [],
      source: "builtin",
    });
  }
  return spells;
}

function parseGpFromKostenToken(token) {
  // Kosten.GP_7 -> 7; Kosten.MINUS_10 -> -10; Kosten.GP_1_pro_1 -> per-level
  const t = token.replace(/^Kosten\./, "");
  let m = /^GP_(\d+)$/.exec(t);
  if (m) return { gp: Number(m[1]), gp_per_level: null, kosten_key: t };
  m = /^MINUS_(\d+)$/.exec(t);
  if (m) return { gp: -Number(m[1]), gp_per_level: null, kosten_key: t };
  m = /^GP_(\d+)_pro_(\d+)$/.exec(t);
  if (m)
    return {
      gp: null,
      gp_per_level: Number(m[1]) / Number(m[2]),
      kosten_key: t,
    };
  m = /^MINUS_(\d+)_PRO_(\d+)/.exec(t);
  if (m)
    return {
      gp: null,
      gp_per_level: -Number(m[1]) / Number(m[2]),
      kosten_key: t,
    };

  // Named Kosten strategies with known default / display labels
  const SPECIAL = {
    GUTES_GEDAECHTNIS: {
      gp: 7,
      cost_label: "7 GP (12 GP for elves or mages)",
    },
    HERAUSRAGENDE_BALANCE: { gp: 20, cost_label: "20 GP" },
    HERAUSRAGENDE_EIGENSCHAFT: {
      gp: null,
      cost_label: "GP = level × (level + 7)",
      formula: "level*(level+7)",
    },
    BALANCE: { gp: 10, cost_label: "10 GP" },
    BEGABUNG_TALENT: {
      gp: 4,
      cost_label: "4–6 GP (by talent group)",
    },
    BEGABUNG_TALENTGRUPPE: {
      gp: null,
      cost_label: "varies by talent group",
    },
    BESONDERER_BESITZ: {
      gp: 7,
      cost_label: "7 GP (3 GP if noble)",
    },
    ASTRALER_BLOCK: {
      gp: -10,
      cost_label: "−10 GP (−5 GP for half-casters)",
    },
    IMMUNITAET_GIFT: {
      gp: 5,
      cost_label: "5 GP (less if Poison Resistance taken)",
    },
    IMMUNITAET_GIFTART: {
      gp: 10,
      cost_label: "10 GP (less if Poison-type Resistance taken)",
    },
    MEISTERHANDWERK: {
      gp: 5,
      cost_label: "5 GP (1 GP for spellcasters)",
    },
    UNFAEHIGKEIT_TALENT: {
      gp: -1,
      cost_label: "grants 1–2 GP (by talent group)",
    },
    UNFAEHIGKEIT_TALENTGRUPPE: {
      gp: -5,
      cost_label: "grants 5–15 GP (by talent group)",
    },
    VERBINDUNGEN: { gp: null, cost_label: "special GP cost (connections)" },
    ALBINO: { gp: null, cost_label: "special GP cost" },
  };
  if (SPECIAL[t]) {
    return {
      gp: SPECIAL[t].gp ?? null,
      gp_per_level: null,
      kosten_key: t,
      cost_label: SPECIAL[t].cost_label,
      formula: SPECIAL[t].formula || null,
    };
  }
  return { gp: null, gp_per_level: null, kosten_key: t };
}

function extractAdvantages(en, de) {
  const file = path.join(SRC, "vornachteile/VorNachteil.java");
  const text = fs.readFileSync(file, "utf8");
  const items = [];
  const byId = new Map();

  // Field = new VorNachteil("id")
  {
    const re = /(\w+)\s*=\s*new\s+VorNachteil\(\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(text))) {
      byId.set(m[2], { field: m[1], id: m[2] });
    }
  }

  // initialisieren(..., Typ.VORTEIL|NACHTEIL|SCHLECHTE_EIGENSCHAFT, Kosten.XXX, ...
  {
    const re =
      /initialisieren\(\s*(?:(\w+)|"([^"]+)")\s*,\s*Typ\.(VORTEIL|NACHTEIL|SCHLECHTE_EIGENSCHAFT)\s*,\s*(Kosten\.\w+)/g;
    let m;
    while ((m = re.exec(text))) {
      const id = m[2] || [...byId.values()].find((x) => x.field === m[1])?.id;
      if (!id) continue;
      const kosten = parseGpFromKostenToken(m[4]);
      const existing = byId.get(id) || { id };
      existing.kind =
        m[3] === "VORTEIL"
          ? "advantage"
          : m[3] === "SCHLECHTE_EIGENSCHAFT"
            ? "negative_trait"
            : "disadvantage";
      existing.gp_cost = kosten.gp;
      existing.gp_per_level = kosten.gp_per_level;
      existing.kosten_key = kosten.kosten_key || m[4].replace(/^Kosten\./, "");
      existing.cost_label = kosten.cost_label || null;
      existing.cost_formula = kosten.formula || null;
      byId.set(id, existing);
    }
  }

  // Stufen bounds
  {
    const re =
      /initialisieren\(\s*(?:(\w+)|"([^"]+)")\s*,\s*Typ\.(?:VORTEIL|NACHTEIL|SCHLECHTE_EIGENSCHAFT)\s*,\s*Kosten\.\w+\s*,\s*(Stufen\.\w+|null)/g;
    let m;
    while ((m = re.exec(text))) {
      const id = m[2] || [...byId.values()].find((x) => x.field === m[1])?.id;
      if (!id) continue;
      const existing = byId.get(id);
      if (!existing) continue;
      const stufen = m[3];
      if (stufen && stufen !== "null") {
        const sm = /STUFE_(\d+)_BIS_(\d+|MAX)/.exec(stufen);
        if (sm) {
          existing.rating_min = Number(sm[1]);
          // MAX = open-ended (no practical upper bound in UI)
          existing.rating_max = sm[2] === "MAX" ? null : Number(sm[2]);
          existing.rating_open_ended = sm[2] === "MAX";
        } else {
          existing.stages_key = stufen.replace(/^Stufen\./, "");
        }
      }
    }
  }

  for (const [id, meta] of byId) {
    items.push({
      id,
      ...namesFor(id, en, de),
      kind: meta.kind || "unknown",
      gp_cost: meta.gp_cost ?? null,
      gp_per_level: meta.gp_per_level ?? null,
      rating_min: meta.rating_min ?? null,
      rating_max: meta.rating_max ?? null,
      rating_open_ended: Boolean(meta.rating_open_ended),
      kosten_key: meta.kosten_key || null,
      cost_label: meta.cost_label || null,
      cost_formula: meta.cost_formula || null,
      source: "builtin",
    });
  }

  for (const [key, val] of en) {
    if (!key.startsWith("VorNachteil.") || !key.endsWith(".Name")) continue;
    const id = key.slice(0, -".Name".length);
    if (byId.has(id)) continue;
    items.push({
      id,
      name: val,
      german_name: de.get(key) || id.split(".").pop(),
      kind: "unknown",
      gp_cost: null,
      gp_per_level: null,
      rating_min: null,
      rating_max: null,
      source: "builtin",
    });
  }
  return items;
}

function extractSpecialAbilities(en, de) {
  const file = path.join(SRC, "sonderfertigkeiten/Sonderfertigkeit.java");
  const talentFile = path.join(SRC, "talente/Talent.java");
  const text = fs.readFileSync(file, "utf8");
  const talentText = fs.readFileSync(talentFile, "utf8");

  const talentFieldToId = new Map();
  {
    const decls = [
      /(\w+)\s*=\s*new\s+Kampftechnik\(\s*"([^"]+)"/g,
      /(\w+)\s*=\s*new\s+Talent\(\s*"([^"]+)"/g,
    ];
    for (const re of decls) {
      let m;
      while ((m = re.exec(talentText))) talentFieldToId.set(m[1], m[2]);
    }
  }

  /** @type {Map<string, object>} */
  const byField = new Map();
  /** Multiple catalog rows may share an id (Schnellladen, expansions). */
  const items = [];

  function ensureField(field) {
    if (!byField.has(field)) {
      byField.set(field, {
        field,
        id: null,
        group_raw: "ALLGEMEIN",
        talent: null,
        prerequisites: [],
        ap_cost: null,
        kosten_key: null,
        variant_source: null,
        free_variant: false,
      });
    }
    return byField.get(field);
  }

  // FIELD = new Sonderfertigkeit("id", Sonderfertigkeitgruppe.X)
  {
    const re =
      /(\w+)\s*=\s*new\s+Sonderfertigkeit\(\s*"([^"]+)"\s*,\s*Sonderfertigkeitgruppe\.(\w+)\s*\)/g;
    let m;
    while ((m = re.exec(text))) {
      const meta = ensureField(m[1]);
      meta.id = m[2];
      meta.group_raw = m[3];
    }
  }
  // FIELD = new Sonderfertigkeit("id", Talent.Y, Sonderfertigkeitgruppe.X)
  {
    const re =
      /(\w+)\s*=\s*new\s+Sonderfertigkeit\(\s*"([^"]+)"\s*,\s*Talent\.(\w+)\s*,\s*Sonderfertigkeitgruppe\.(\w+)\s*\)/g;
    let m;
    while ((m = re.exec(text))) {
      const meta = ensureField(m[1]);
      meta.id = m[2];
      meta.talent = talentFieldToId.get(m[3]) || null;
      meta.group_raw = m[4];
    }
  }

  // initialisieren(FIELD, Kosten.X, Voraussetzung...)
  {
    const re =
      /initialisieren\(\s*(\w+)\s*,\s*(Kosten\.\w+)\s*((?:,\s*(?:new\s+Voraussetzung\[0\]|Voraussetzung\.\w+))*)/g;
    let m;
    while ((m = re.exec(text))) {
      const meta = ensureField(m[1]);
      meta.kosten_key = m[2].replace(/^Kosten\./, "");
      const ap = /AP_(\d+)/.exec(meta.kosten_key);
      meta.ap_cost = ap ? Number(ap[1]) : null;
      meta.prerequisites = (m[3].match(/Voraussetzung\.(\w+)/g) || []).map(
        (s) => s.replace(/^Voraussetzung\./, "")
      );
    }
  }

  // initialisieren("id", Sonderfertigkeitgruppe.X, Kosten.Y, Voraussetzung...)
  {
    const re =
      /initialisieren\(\s*"([^"]+)"\s*,\s*Sonderfertigkeitgruppe\.(\w+)\s*,\s*(Kosten\.\w+)\s*((?:,\s*Voraussetzung\.\w+)*)/g;
    let m;
    while ((m = re.exec(text))) {
      const id = m[1];
      const group_raw = m[2];
      const kosten_key = m[3].replace(/^Kosten\./, "");
      const ap = /AP_(\d+)/.exec(kosten_key);
      const prerequisites = (m[4].match(/Voraussetzung\.(\w+)/g) || []).map(
        (s) => s.replace(/^Voraussetzung\./, "")
      );
      // May already exist as FIELD-based; prefer updating by id
      let meta = [...byField.values()].find((x) => x.id === id);
      if (!meta) {
        meta = {
          field: id,
          id,
          group_raw,
          talent: null,
          prerequisites,
          ap_cost: ap ? Number(ap[1]) : null,
          kosten_key,
          variant_source: null,
          free_variant: false,
        };
        byField.set(id, meta);
      } else {
        meta.group_raw = group_raw;
        meta.kosten_key = kosten_key;
        meta.ap_cost = ap ? Number(ap[1]) : meta.ap_cost;
        meta.prerequisites = prerequisites.length
          ? prerequisites
          : meta.prerequisites;
      }
    }
  }

  // FIELD.setVarianten(...) chained on same initialisieren statement
  {
    const re =
      /initialisieren\(\s*(\w+)\s*,[^;]+\)\.setVarianten\(([^;]+)\)/g;
    let m;
    while ((m = re.exec(text))) {
      const meta = ensureField(m[1]);
      const arg = m[2].trim();
      if (arg.includes("Varianten.KULTURKUNDE")) meta.variant_source = "kulturkunde";
      else if (arg.includes("Varianten.RUESTUNGEN")) meta.variant_source = "armor";
      else if (arg.includes("Varianten.REPRAESENTATION"))
        meta.variant_source = "representation";
      else if (/new\s+String\s*\[\s*0\s*\]/.test(arg)) {
        meta.variant_source = "free_text";
        meta.free_variant = true;
      }
    }
  }

  // initialisiereGelaendekunde(FIELD) — AP via Kosten.GELAENDEKUNDE
  {
    const re = /initialisiereGelaendekunde\(\s*(\w+)\s*\)/g;
    let m;
    while ((m = re.exec(text))) {
      const meta = ensureField(m[1]);
      if (!meta.kosten_key) {
        meta.kosten_key = "GELAENDEKUNDE";
        meta.ap_cost = meta.ap_cost ?? 150;
      }
    }
  }

  const seenKeys = new Set();
  for (const meta of byField.values()) {
    if (!meta.id) continue;
    const key = `${meta.id}|${meta.talent || ""}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const expand = SF_EXPAND_TEMPLATES[meta.id] || null;
    const variant_source =
      meta.variant_source || SF_VARIANT_SOURCE[meta.id] || null;

    items.push({
      id: meta.id,
      ...namesFor(meta.id, en, de),
      group: GROUP_MAP[meta.group_raw] || meta.group_raw.toLowerCase(),
      group_raw: meta.group_raw,
      talent: meta.talent,
      ap_cost: meta.ap_cost ?? null,
      kosten_key: meta.kosten_key || null,
      prerequisites: meta.prerequisites || [],
      expand_template: expand,
      variant_source,
      free_variant: Boolean(meta.free_variant) || variant_source === "free_text",
      source: "builtin",
    });
  }

  // Ensure template stubs exist even if only referenced dynamically
  for (const [id, expand] of Object.entries(SF_EXPAND_TEMPLATES)) {
    if (items.some((x) => x.id === id)) continue;
    items.push({
      id,
      ...namesFor(id, en, de),
      group:
        expand === "weapon_specialization"
          ? "weapon_specialization"
          : expand === "talent_specialization"
            ? "talent_specialization"
            : "combat",
      group_raw:
        expand === "weapon_specialization"
          ? "WAFFENSPEZIALISIERUNG"
          : expand === "talent_specialization"
            ? "TALENTSPEZIALISIERUNG"
            : "KAMPF",
      talent: null,
      ap_cost: null,
      kosten_key:
        expand === "talent_specialization"
          ? "TALENTSPEZIALISIERUNG"
          : expand === "weapon_specialization"
            ? "WAFFENSPEZIALISIERUNG"
            : "AP_300",
      prerequisites: ["SPEZIALISIERUNG"],
      expand_template: expand,
      variant_source: null,
      free_variant: true,
      source: "builtin",
    });
  }

  for (const [key, val] of en) {
    if (!key.startsWith("Sonderfertigkeit.") || !key.endsWith(".Name")) continue;
    const id = key.slice(0, -".Name".length);
    if (items.some((x) => x.id === id)) continue;
    if (SF_EXPAND_TEMPLATES[id]) continue;
    items.push({
      id,
      name: val,
      german_name: de.get(key) || id.split(".").pop(),
      group: "general",
      group_raw: "ALLGEMEIN",
      talent: null,
      ap_cost: null,
      prerequisites: [],
      expand_template: null,
      variant_source: SF_VARIANT_SOURCE[id] || null,
      free_variant: SF_VARIANT_SOURCE[id] === "free_text",
      source: "builtin",
    });
  }
  return items;
}

function extractVariantLabels(en, de) {
  const prefixes = [
    "Kulturkunde.",
    "Repraesentation.",
    "Talent.Spezialisierung.",
    "Waffe.",
    "Talentgruppe.",
  ];
  const byId = new Map();
  for (const [key, val] of en) {
    if (!prefixes.some((p) => key.startsWith(p))) continue;
    let id;
    if (key.endsWith(".Name")) {
      id = key.slice(0, -".Name".length);
    } else if (
      key.startsWith("Talent.Spezialisierung.") &&
      !key.includes(".Name") &&
      !key.endsWith(".Kuerzel")
    ) {
      // Specializations use bare keys: Talent.Spezialisierung.Balancieren=balance
      id = key;
    } else {
      continue;
    }
    if (!val || !String(val).trim()) continue;
    byId.set(id, {
      id,
      name: val,
      german_name: de.get(key) || de.get(`${id}.Name`) || id.split(".").pop(),
      source: "builtin",
    });
  }
  return [...byId.values()];
}

function extractSkt() {
  return {
    columns: ["A*", "A", "B", "C", "D", "E", "F", "G", "H"],
    factors: [1, 1, 2, 3, 4, 5, 8, 10, 20],
    // index 0 of each column = activation cost; indices 1..31 = cost to raise TO that level from previous
    costs: [
      [5, 1, 1, 1, 2, 4, 5, 6, 8, 9, 11, 12, 14, 15, 17, 19, 20, 22, 24, 25, 27, 29, 31, 32, 34, 36, 38, 40, 42, 43, 45, 48],
      [5, 1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14, 16, 17, 19, 21, 22, 24, 26, 27, 29, 31, 33, 34, 36, 38, 40, 42, 44, 45, 47, 50],
      [10, 2, 4, 6, 8, 11, 14, 17, 19, 22, 25, 28, 32, 35, 38, 41, 45, 48, 51, 55, 58, 62, 65, 69, 73, 76, 80, 84, 87, 91, 95, 100],
      [15, 2, 6, 9, 13, 17, 21, 25, 29, 34, 38, 43, 47, 51, 55, 60, 65, 70, 75, 80, 85, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 150],
      [20, 3, 7, 12, 17, 22, 27, 33, 39, 45, 50, 55, 65, 70, 75, 85, 90, 95, 105, 110, 115, 125, 130, 140, 145, 150, 160, 165, 170, 180, 190, 200],
      [25, 4, 9, 15, 21, 28, 34, 41, 48, 55, 65, 70, 80, 85, 95, 105, 110, 120, 130, 135, 145, 155, 165, 170, 180, 190, 200, 210, 220, 230, 240, 250],
      [40, 6, 14, 22, 32, 41, 50, 60, 75, 85, 95, 105, 120, 130, 140, 155, 165, 180, 195, 210, 220, 230, 250, 260, 270, 290, 300, 310, 330, 340, 350, 375],
      [50, 8, 18, 30, 42, 55, 70, 85, 95, 110, 125, 140, 160, 175, 190, 210, 220, 240, 260, 270, 290, 310, 330, 340, 360, 380, 400, 420, 440, 460, 480, 500],
      [100, 16, 35, 60, 85, 110, 140, 165, 195, 220, 250, 280, 320, 350, 380, 410, 450, 480, 510, 550, 580, 620, 650, 690, 720, 760, 800, 830, 870, 910, 950, 1000],
    ],
  };
}

function extractSprachfamilien(en, de) {
  // From Sprachfamilie.java enum-ish names in localization
  const families = [];
  for (const [key, val] of en) {
    if (!key.startsWith("Sprachfamilie.") || !key.endsWith(".Name")) continue;
    const id = key.slice(0, -".Name".length);
    families.push({
      id,
      name: val,
      german_name: de.get(key) || id.split(".").pop(),
    });
  }
  if (!families.length) {
    // fallback common families
    return [
      "Garethi",
      "Tulamidya",
      "Nujuka",
      "Thorwalsch",
      "Zwergisch",
      "Elfisch",
      "Orkisch",
      "Goblinisch",
      "Achaz",
      "Fuechsisch",
    ].map((n) => ({
      id: `Sprachfamilie.${n}`,
      name: n,
      german_name: n,
    }));
  }
  return families;
}

function main() {
  console.log("Loading localization…");
  const en = parseProperties(path.join(RES, "i18n/Lokalisierung_en.properties"));
  const dePath = fs.existsSync(path.join(RES, "i18n/Lokalisierung_de.properties"))
    ? path.join(RES, "i18n/Lokalisierung_de.properties")
    : path.join(RES, "i18n/Lokalisierung.properties");
  const de = parseProperties(dePath);

  const bausteineOnly = process.argv.includes("--bausteine-only");

  console.log("Extracting races/cultures/professions…");
  writeJson(
    "rassen.json",
    extractBausteine(path.join(RES, "daten/rassen"), "Rasse", en, de)
  );
  writeJson(
    "kulturen.json",
    extractBausteine(path.join(RES, "daten/kulturen"), "Kultur", en, de)
  );
  writeJson(
    "professionen.json",
    extractBausteine(path.join(RES, "daten/professionen"), "Profession", en, de)
  );

  if (bausteineOnly) {
    console.log("Done (--bausteine-only).");
    return;
  }

  console.log("Extracting equipment…");
  writeJson("waffen_nahkampf.json", extractMelee(en, de));
  writeJson("waffen_fernkampf.json", extractRanged(en, de));
  writeJson("ruestungen.json", extractArmor(en, de));
  writeJson("schilde.json", extractShields(en, de));

  console.log("Extracting talents/spells…");
  writeJson("talente.json", extractTalents(en, de));
  writeJson("zauber.json", extractSpells(en, de));
  writeJson("skt.json", extractSkt());
  writeJson("sprachfamilien.json", extractSprachfamilien(en, de));

  console.log("Extracting advantages & special abilities…");
  writeJson("vornachteile.json", extractAdvantages(en, de));
  writeJson("sonderfertigkeiten.json", extractSpecialAbilities(en, de));
  writeJson("variant_labels.json", extractVariantLabels(en, de));

  console.log("Extracting name factories…");
  writeJson("namenlisten.json", extractNamenlisten(en, de));
  writeJson("name_factories.json", extractNameFactories(en, de));
  writeJson("color_labels.json", extractColorLabels(en, de));

  console.log("Done.");
}

function extractNamenlisten(en, de) {
  const parsed = parseXmlFile(
    path.join(RES, "daten/diverses/Namenlisten.xml")
  );
  return asArray(parsed.Namenlisten?.Namenliste).map((nl) => {
    const id = nl["@_Id"];
    const names = asArray(nl.Name)
      .map((n) => {
        if (typeof n === "string") return n;
        const key = n["@_Lokalisierungsschluessel"];
        if (key) return en.get(key) || de.get(key) || key.replace(/^Name\./, "").replace(/\.Name$/, "");
        return textOf(n);
      })
      .filter(Boolean);
    return {
      id,
      name: en.get(`${id}.Bezeichnung`) || de.get(`${id}.Bezeichnung`) || id,
      names,
      source: "builtin",
    };
  });
}

function extractNameFactories(en, de) {
  const parsed = parseXmlFile(
    path.join(RES, "daten/diverses/NameFactorys.xml")
  );
  function formats(node) {
    return asArray(node?.Format)
      .map((f) => (typeof f === "string" ? f : textOf(f)))
      .filter(Boolean);
  }
  return asArray(parsed.NameFactorys?.NameFactory).map((nf) => {
    const id = nf["@_Id"];
    const form = nf.Formate || {};
    const lists = asArray(nf.Namenlisten?.Namenliste).map((nl) => ({
      list_id: nl["@_Id"],
      placeholder: nl["@_Schluessel"] || "",
    }));
    return {
      id,
      name: en.get(`${id}.Bezeichnung`) || de.get(`${id}.Bezeichnung`) || id,
      formats_male: formats(form.FormateNameMaennlich),
      formats_male_noble: formats(form.FormateNameMaennlichAdlig),
      formats_female: formats(form.FormateNameWeiblich),
      formats_female_noble: formats(form.FormateNameWeiblichAdlig),
      name_lists: lists,
      source: "builtin",
    };
  });
}

function extractColorLabels(en, de) {
  const keys = [
    "blauschwarz",
    "blond",
    "braun",
    "dunkelblond",
    "dunkelbraun",
    "dunkelgrau",
    "feuerrot",
    "hellblond",
    "hellbraun",
    "hellgrau",
    "kupferrot",
    "mittelblond",
    "mittelbraun",
    "rot",
    "rotblond",
    "salzweiss",
    "schwarz",
    "silbern",
    "silberweiss",
    "weiss",
    "weissblond",
    "blau",
    "gruen",
    "grau",
    "bernstein",
    "amethyst",
    "smaragd",
    "rubin",
    "saphir",
    "gold",
    "silber",
    "violett",
    "rotbraun",
  ];
  const out = {};
  for (const k of keys) {
    out[k] = en.get(k) || de.get(k) || k;
  }
  // Also pull any short color keys from en that look like single-token colors
  for (const [key, val] of en) {
    if (key.includes(".")) continue;
    if (key.length > 20) continue;
    if (/^[a-z]+$/.test(key) && !out[key]) out[key] = val;
  }
  return out;
}

main();
