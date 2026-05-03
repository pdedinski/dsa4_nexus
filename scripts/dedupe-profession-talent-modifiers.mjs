#!/usr/bin/env node
/**
 * Drops talent_modifiers keys that duplicate an accompanying talent_choice_modifiers row
 * (same weapon pick-one semantics with matching TP value).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFESSIONS = path.join(__dirname, "../data/core/professions.json");

const SAME_VALUE_COMPOSITES = [
  {
    modifierKey: "crossbow_or_bow_or_throwing_spear",
    fromCanonical: ["crossbows", "bows", "throwing_spears"],
    valueMatchesChoice: true,
  },
  {
    modifierKey: "crossbow_or_bow_or_throwing_knives",
    fromCanonical: ["crossbows", "bows", "throwing_knives"],
    valueMatchesChoice: true,
  },
  {
    modifierKey: "crossbow_or_bow",
    fromCanonical: ["crossbows", "bows"],
    valueMatchesChoice: true,
  },
  {
    modifierKey: "maces_or_sabers",
    fromCanonical: ["axes_and_maces", "sabers"],
    valueMatchesChoice: true,
  },
  {
    modifierKey: "climbing_or_boating",
    fromCanonical: ["climb", "boats"],
    valueMatchesChoice: true,
  },
];

const ALIAS = new Map([
  ["bow", "bows"],
  ["crossbow", "crossbows"],
  ["maces", "axes_and_maces"],
  ["throwing_spear", "throwing_spears"],
  ["throwing_axe", "throwing_axes"],
  ["throwing_knife", "throwing_knives"],
  ["climbing", "climb"],
  ["boating", "boats"],
]);

function canon(s) {
  return ALIAS.get(s) ?? s;
}

function choiceMatches(canonicalPool, choiceFrom, valueMatchesChoice, modVal, choiceVal) {
  if (
    canonicalPool.length !== choiceFrom.length ||
    new Set(canonicalPool).size !== canonicalPool.length
  )
    return false;
  const a = new Set(canonicalPool);
  const b = new Set(choiceFrom.map(canon));
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return !valueMatchesChoice || modVal === choiceVal;
}

const j = JSON.parse(fs.readFileSync(PROFESSIONS, "utf8"));
let removed = [];

for (const p of j.professions) {
  const tm = { ...(p.talent_modifiers ?? {}) };
  const tc = p.talent_choice_modifiers ?? [];
  for (const rule of SAME_VALUE_COMPOSITES) {
    const modVal = tm[rule.modifierKey];
    if (modVal === undefined) continue;
    for (const b of tc) {
      if (
        typeof b.choose === "number" &&
        typeof b.value === "number" &&
        Array.isArray(b.from) &&
        choiceMatches(
          rule.fromCanonical,
          b.from,
          rule.valueMatchesChoice,
          modVal,
          b.value
        )
      ) {
        delete p.talent_modifiers[rule.modifierKey];
        removed.push(`${p.id}: ${rule.modifierKey}`);
        break;
      }
    }
  }

  const prim = tm.maces_or_sabers_primary;
  const sec = tm.maces_or_sabers_secondary;
  if (prim !== undefined || sec !== undefined) {
    const blocks = tc.filter(
      (b) =>
        typeof b.choose === "number" &&
        typeof b.value === "number" &&
        Array.isArray(b.from),
    );
    const meleeChoices = blocks.filter((b) => {
      const f = new Set(b.from.map(canon));
      return (
        f.size === 2 &&
        f.has("axes_and_maces") &&
        f.has("sabers") &&
        (String(b.note ?? "").toLowerCase().includes("primary") ||
          b.value === prim)
      );
    });
    if (
      meleeChoices.length &&
      meleeChoices[0].value === prim &&
      (sec === undefined ||
        blocks.some((b) => String(b.note ?? "").toLowerCase().includes("second") && b.value === sec))
    ) {
      if (prim !== undefined) {
        delete p.talent_modifiers.maces_or_sabers_primary;
        removed.push(`${p.id}: maces_or_sabers_primary`);
      }
      if (sec !== undefined) {
        delete p.talent_modifiers.maces_or_sabers_secondary;
        removed.push(`${p.id}: maces_or_sabers_secondary`);
      }
    }
  }
}

fs.writeFileSync(PROFESSIONS, JSON.stringify(j, null, 2) + "\n");
console.log("Removed duplicate modifier keys:", removed.length);
removed.forEach((x) => console.log(" ", x));
