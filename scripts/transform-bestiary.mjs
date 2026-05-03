/**
 * Transforms raw Zoo-Botanica heuristic JSON into data/bestiary/beasts.json.
 * Book group headers (`is_group_entry`) are used only to resolve categories;
 * they are NOT written to the output file.
 *
 * Usage: node scripts/transform-bestiary.mjs [input.json]
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT =
  "E:/Temp/downloads/zoo_botanica_bestiary_categories_english.json";
const OUTPUT = path.join(process.cwd(), "data/bestiary/beasts.json");

const PARENT_LABEL_ALIASES = {
  "Woodlice and Isopods": "Woodlice / Isopods",
  "Deer, Elk and Roe Deer": "Deer, Elk, and Roe Deer",
  "Swarm and Mass Creatures": "Swarms, Heaps, and Small Vermin",
};

function normWords(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[&/]/g, " ")
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return new Set(
    normWords(s)
      .split(" ")
      .filter((w) => w.length > 1),
  );
}

function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const u = a.size + b.size - inter;
  return u === 0 ? 0 : inter / u;
}

function suspiciousStats(stats) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return false;
  const atk = stats.AT ?? stats.damage;
  const dmg = stats.damage;
  if (typeof dmg === "string") {
    const t = dmg.trim();
    if (t === "1d" || t === "d" || t === "/" || /^-?[a-z]$/.test(t)) return true;
  }
  if (typeof atk === "string") {
    const t = atk.trim();
    if (t === "/" || t === "-" || /^-?[a-z]$/.test(t)) return true;
  }
  const pa = stats.PA;
  if (typeof pa === "string" && /^-d\b/i.test(pa.trim())) return true;
  return false;
}

function pruneEmpty(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.filter((x) => x != null && x !== "");
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)
      continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

const inputPath = process.argv[2] || DEFAULT_INPUT;
const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const beasts = raw.beasts;
if (!Array.isArray(beasts)) {
  console.error("Expected top-level beasts array");
  process.exit(1);
}

const groupRows = beasts.filter((b) => b.is_group_entry === true);
const nameById = new Map(groupRows.map((g) => [g.id, g.name]));
const normalizedNameToId = new Map();
for (const g of groupRows) {
  normalizedNameToId.set(normWords(g.name), g.id);
}

function resolveParentLabel(rawCat) {
  if (rawCat == null || rawCat === "") return null;
  const alias = PARENT_LABEL_ALIASES[String(rawCat).trim()];
  const cand = alias ?? String(rawCat).trim();

  let id = normalizedNameToId.get(normWords(cand));
  if (id) return { id, label: String(nameById.get(id)) };

  const t = tokens(cand);
  let best = null;
  let bestScore = 0;
  for (const g of groupRows) {
    const sc = jaccard(t, tokens(g.name));
    if (sc > bestScore) {
      bestScore = sc;
      best = g;
    }
  }
  if (best && bestScore >= 0.5) return { id: best.id, label: best.name };

  return { id: null, label: cand };
}

const outBeasts = [];

for (const b of beasts) {
  if (b.is_group_entry === true) continue;

  const id = String(b.id ?? "").trim();
  if (!id) continue;

  const rawParent = b.category ?? b.category_name ?? null;
  let parent_group_id = null;
  let parent_group_name = null;

  if (b.parent_group_id != null && String(b.parent_group_id).trim() !== "") {
    parent_group_id = String(b.parent_group_id);
    parent_group_name =
      b.parent_group_name != null
        ? String(b.parent_group_name)
        : nameById.get(parent_group_id) ?? null;
  } else if (b.parent_group_name != null && String(b.parent_group_name).trim() !== "") {
    const r = resolveParentLabel(String(b.parent_group_name));
    parent_group_id = r.id;
    parent_group_name = r.label;
  } else if (rawParent) {
    const r = resolveParentLabel(rawParent);
    parent_group_id = r.id;
    parent_group_name = r.label;
  }

  const statsRaw = pruneEmpty(
    b.stats && typeof b.stats === "object" ? { ...b.stats } : {},
  );
  const stats =
    statsRaw && Object.keys(statsRaw).length ? statsRaw : undefined;

  /** @type Record<string, unknown> */
  const out = {
    id,
    name: String(b.name ?? id),
    german_name: b.german_name != null ? String(b.german_name) : null,
    source: b.source != null ? String(b.source) : undefined,
    source_page:
      typeof b.source_page === "number" && Number.isFinite(b.source_page)
        ? b.source_page
        : undefined,
  };

  if (parent_group_id) out.parent_group_id = parent_group_id;
  if (parent_group_name) out.parent_group_name = parent_group_name;

  const phys = pruneEmpty(b.physical);
  if (phys) out.physical = phys;

  if (typeof b.distribution === "string" && b.distribution.trim())
    out.distribution = b.distribution.trim();
  if (typeof b.appearance === "string" && b.appearance.trim())
    out.appearance = b.appearance.trim();

  if (stats) out.stats = stats;

  if (Array.isArray(b.special_abilities) && b.special_abilities.length) {
    out.special_abilities = b.special_abilities.map(String);
  }
  if (Array.isArray(b.special_combat_rules) && b.special_combat_rules.length) {
    out.special_combat_rules = b.special_combat_rules.map(String);
  }

  const loot = pruneEmpty(b.loot);
  if (loot) out.loot = loot;

  if (typeof b.description === "string" && b.description.trim()) {
    out.description = b.description.trim();
  }

  if (suspiciousStats(out.stats)) {
    out.needs_data_review = true;
  }

  outBeasts.push(out);
}

const reviewCount = outBeasts.filter((t) => t.needs_data_review).length;
const withCategory = outBeasts.filter((t) => t.parent_group_name).length;

function slimDerivedMeta(m) {
  if (!m || typeof m !== "object") return {};
  /** @type Record<string, unknown> */
  const { taxonomy_groups: _tg, derived_from: inner, ...rest } =
    /** @type Record<string, unknown> */ (m);
  const out = { ...rest };
  if (inner && typeof inner === "object" && inner !== null) {
    const { taxonomy_groups: _tg2, ...innerRest } = inner;
    out.derived_from = innerRest;
  }
  return out;
}

const meta = {
  schema_version: "2.2",
  derived_from: slimDerivedMeta(raw.meta ?? {}),
  last_updated: raw.meta?.last_updated ?? undefined,
  description:
    "Zoo-Botanica Aventurica bestiary creatures (English-facing). Each entry may include `parent_group_name` / `parent_group_id` for book category grouping. Group header rows from the extraction are omitted.",
  source_books: raw.meta?.source_books ?? ["Zoo-Botanica Aventurica"],
  entry_count: outBeasts.length,
  entries_with_category: withCategory,
  entries_flagged_review: reviewCount,
};

const doc = { meta, beasts: outBeasts };

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(doc, null, 2), "utf8");
console.warn(
  `Wrote ${OUTPUT} (${outBeasts.length} creatures, ${withCategory} with category, ${reviewCount} flagged needs_data_review).`,
);
