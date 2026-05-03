/**
 * Merges WdH expanded races (with new ids) into data/core/races.json and wires
 * data/core/cultures.json so race↔culture pairs stay consistent for chargen.
 *
 * WdH cites cultures we do not have as JSON entries; unsupported culture ids are
 * replaced with a deterministic BR-only bridge list per race id.
 *
 * Usage: node scripts/merge-races-expanded.mjs [races_expanded_wdh_english.json]
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_EXPANDED =
  "E:/Temp/downloads/races_expanded_wdh_english.json";
const REPO_ROOT = process.cwd();
const RACES_JSON = path.join(REPO_ROOT, "data/core/races.json");
const CULTURES_JSON = path.join(REPO_ROOT, "data/core/cultures.json");

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function normalizeExclusiveDisadvantage(d) {
  if (!d || typeof d !== "object") return d;
  const o = d;
  if (o.id !== "arrogance_or_vengefulness") return d;
  const r = typeof o.rating === "number" ? o.rating : 5;
  return {
    id: "arrogance_or_vengefulness_choice",
    rating: r,
    note:
      typeof o.note === "string" && o.note.trim()
        ? o.note.trim()
        : "Choose exactly one: Arrogance or Vengefulness at this rating (not both).",
    pick_one_disadvantages: [
      { id: "arrogance", rating: r },
      { id: "vengefulness", rating: r },
    ],
  };
}

/** When expanded lists only WdH-specific culture keys, bridge to playable BR cultures. */
const FALLBACK_ALLOWED_CULTURES = {
  nivesian: ["bornland", "middenrealm_cities", "andergast_nostria"],
  norbard: ["middenrealm_cities", "andergast_nostria", "bornland"],
  trollzacker: ["thorwal", "bornland"],
  rochshaz: ["thorwal", "bornland"],
  forest_person: ["tulamidian_city_states", "southern_aventuria"],
  tocamuyac: ["tulamidian_city_states", "southern_aventuria"],
  utulu: ["tulamidian_city_states", "southern_aventuria"],
  forest_elf: ["lea_elves"],
  firn_elf: ["lea_elves"],
  standard_dwarf: ["anvil_dwarves"],
  brilliant_dwarf: ["anvil_dwarves"],
  wild_dwarf: ["anvil_dwarves"],
  ork: ["thorwal", "middenrealm_cities", "southern_aventuria", "bornland"],
  ork_woman: ["thorwal", "middenrealm_cities", "southern_aventuria", "bornland"],
  half_orc: [
    "middenrealm_cities",
    "southern_aventuria",
    "tulamidian_city_states",
    "thorwal",
  ],
  goblin: ["middenrealm_cities", "southern_aventuria", "tulamidian_city_states"],
  goblin_woman: [
    "middenrealm_cities",
    "southern_aventuria",
    "tulamidian_city_states",
  ],
  achaz: ["tulamidian_city_states", "southern_aventuria"],
  forest_island_achaz: ["tulamidian_city_states", "southern_aventuria"],
  maraskan_achaz: ["tulamidian_city_states", "southern_aventuria", "horasian_empire"],
  orkland_achaz: ["thorwal", "southern_aventuria", "tulamidian_city_states"],
};

function expandNovadis(cid) {
  return cid === "novadis" ? ["novadis_men", "novadis_women"] : [cid];
}

/**
 * Declared cultures that exist as JSON minus `novadis` surrogate handling.
 */
function declaredCulturesResolvable(declared, cultureIds) {
  return [...new Set((declared ?? []).flatMap(expandNovadis))].filter((c) =>
    cultureIds.has(c),
  );
}

function finalizeAllowedCultures(raceId, declared, cultureIds) {
  const resolved = declaredCulturesResolvable(declared, cultureIds);
  if (resolved.length > 0)
    return { resolved, usedFallback: false };
  const bridged = FALLBACK_ALLOWED_CULTURES[raceId];
  if (!bridged?.length)
    throw new Error(
      `merge-races-expanded: no BR culture bridge for unsupported race declarations on "${raceId}"`,
    );
  return {
    resolved: bridged.slice(),
    usedFallback: true,
  };
}

/** Add each race id to every culture's allowed_races it declares (post-resolve). */
function patchCulturesAllowedRaces(culturesDoc, raceIdListByCultureId) {
  const doc = deepClone(culturesDoc);
  for (const culture of doc.cultures) {
    const add = raceIdListByCultureId.get(culture.id);
    if (!add || !add.size) continue;
    const cur = culture.allowed_races ?? [];
    culture.allowed_races = [...new Set([...cur, ...add])].sort((a, b) =>
      a.localeCompare(b, "en"),
    );
  }
  return doc;
}

function verifyIntersection(racesMerged, culturesDoc) {
  const cmap = new Map(culturesDoc.cultures.map((c) => [c.id, c]));
  for (const r of racesMerged) {
    let paired = false;
    for (const cid of r.allowed_cultures) {
      const c = cmap.get(cid);
      if (c?.allowed_races?.includes(r.id)) {
        paired = true;
        break;
      }
    }
    if (!paired)
      throw new Error(
        `Race "${r.id}" has no culture intersection after merge (check bridging + patches).`,
      );
  }
}

function main() {
  const expandedPath = process.argv[2] || DEFAULT_EXPANDED;
  const expandedDoc = JSON.parse(fs.readFileSync(expandedPath, "utf8"));
  const prevRacesDoc = JSON.parse(fs.readFileSync(RACES_JSON, "utf8"));
  const culturesDoc = JSON.parse(fs.readFileSync(CULTURES_JSON, "utf8"));
  const prevByRaceId = new Map(prevRacesDoc.races.map((r) => [r.id, r]));
  const cultureIds = new Set(culturesDoc.cultures.map((c) => c.id));

  const raceToCultureLinks = new Map();

  const racesMerged = expandedDoc.races.map((race) => {
    const legacy = prevByRaceId.get(race.id);
    const out = deepClone(race);
    const FALLBACK_REPO_KEYS = [
      "magic_status_notes",
      "elvish_upbringing_variant",
    ];
    if (legacy) {
      for (const k of FALLBACK_REPO_KEYS) {
        if (out[k] === undefined && legacy[k] !== undefined) out[k] = deepClone(legacy[k]);
      }
    }
    if (Array.isArray(out.automatic_disadvantages)) {
      out.automatic_disadvantages = out.automatic_disadvantages.map(
        normalizeExclusiveDisadvantage,
      );
    }
    const { resolved, usedFallback } = finalizeAllowedCultures(
      race.id,
      out.allowed_cultures,
      cultureIds,
    );
    out.allowed_cultures = resolved;

    if (usedFallback)
      out.chargen_culture_bridge_note =
        "WdH lists cultures not present in Nexus data yet — playable cultures were bridged to Basic Rules entries so random creation stays consistent.";

    for (const cid of resolved) {
      if (!raceToCultureLinks.has(cid)) raceToCultureLinks.set(cid, new Set());
      raceToCultureLinks.get(cid).add(out.id);
    }
    return out;
  });

  const culturesMerged = patchCulturesAllowedRaces(culturesDoc, raceToCultureLinks);

  verifyIntersection(racesMerged, culturesMerged);

  const mergedRacesPayload = {
    meta: deepClone(expandedDoc.meta ?? {}),
    races: racesMerged,
  };

  fs.writeFileSync(RACES_JSON, JSON.stringify(mergedRacesPayload, null, 2));
  fs.writeFileSync(CULTURES_JSON, JSON.stringify(culturesMerged, null, 2));

  const addedRaceCount = racesMerged.length - prevRacesDoc.races.length;
  console.warn(
    `Wrote ${racesMerged.length} races (+${addedRaceCount} vs previous) → ${path.relative(REPO_ROOT, RACES_JSON)}`,
  );
  console.warn(`Patched allowed_races in cultures → ${path.relative(REPO_ROOT, CULTURES_JSON)}`);

  console.warn(`
Note: many WdH automatic advantages/disadvantages use ids missing from Nexus data/dumps.
Run \`node scripts/analyze-expanded-race-traits.mjs\` against the merged result to list gaps — codex/peek links for those traits may fail until stubs are imported.
`.trim(),
  );
}

main();
