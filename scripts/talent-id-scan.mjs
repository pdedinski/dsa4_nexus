#!/usr/bin/env node
/**
 * Collect talent_modifier / talent_choice "from" keys not in catalog.
 * Usage: node scripts/talent-id-scan.mjs [paths to JSON roots...]
 * Defaults: races.json, professions expanded, cultures expanded.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const tierFiles = [
  "data/talents/combat_talents.json",
  "data/talents/physical_talents.json",
  "data/talents/social_talents.json",
  "data/talents/nature_talents.json",
  "data/talents/lore_talents.json",
  "data/talents/artisan_talents.json",
  "data/talents/languages_scripts.json",
];

const ids = new Set();
for (const f of tierFiles) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
  for (const t of j.talents) ids.add(t.id);
}

function load(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function scanEntities(entities, out) {
  for (const e of entities) {
    walk(e, "", out);
  }
}

function walk(obj, prefix, out) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const x of obj) walk(x, prefix, out);
    return;
  }
  const tm = obj.talent_modifiers;
  if (tm && typeof tm === "object") {
    for (const k of Object.keys(tm)) {
      if (!ids.has(k)) {
        const key = prefix ? `${prefix}::modifier::${k}` : `modifier::${k}`;
        out.set(key, (out.get(key) || 0) + 1);
      }
    }
  }
  const tc = obj.talent_choice_modifiers;
  if (Array.isArray(tc)) {
    for (const b of tc) {
      if (!Array.isArray(b?.from)) continue;
      for (const k of b.from) {
        if (!ids.has(k)) {
          const key = prefix ? `${prefix}::choice::${k}` : `choice::${k}`;
          out.set(key, (out.get(key) || 0) + 1);
        }
      }
    }
  }
}

const defaultPaths = [
  { file: path.join(ROOT, "data/core/races.json"), key: "races", label: "races" },
  {
    file: "e:\\Temp\\downloads\\professions_expanded_wdh_english.json",
    key: "professions",
    label: "professions_expanded",
  },
  {
    file: "e:\\Temp\\downloads\\cultures_expanded_wdh_english.json",
    key: "cultures",
    label: "cultures_expanded",
  },
];

const args = process.argv.slice(2);
const targets =
  args.length > 0
    ? args.map((a) => {
        const j = load(a);
        const key =
          Array.isArray(j.races)
            ? "races"
            : Array.isArray(j.professions)
              ? "professions"
              : Array.isArray(j.cultures)
                ? "cultures"
                : null;
        if (!key)
          throw new Error(`Cannot detect array root in ${a}`);
        return { file: a, key, label: path.basename(a) };
      })
    : defaultPaths;

const bySlug = new Map();

for (const t of targets) {
  let j;
  try {
    j = load(t.file);
  } catch (e) {
    console.warn("Skip missing:", t.file, e.message);
    continue;
  }
  const list = j[t.key];
  if (!Array.isArray(list)) {
    console.warn("Skip bad root:", t.file, t.key);
    continue;
  }
  const out = new Map();
  scanEntities(list, out);
  console.log("\n===", t.label, "unknown keys:", out.size);
  [...out.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 80)
    .forEach(([k, n]) => console.log(n, k));
  for (const [k, n] of out) {
    const slug =
      k.split("::").pop()?.replace(/^modifier::|^choice::/, "") ?? k;
    bySlug.set(slug, (bySlug.get(slug) || 0) + n);
  }
}

console.log("\n=== Combined unique slug counts (modifier + choice refs)");
console.log(
  [...bySlug.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
);
