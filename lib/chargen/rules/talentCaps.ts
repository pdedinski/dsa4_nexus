/**
 * Talent/spell level caps (Höchststufe) and combat AT/PA spread checks.
 * Mirrors Java `StufenTalent`, `StufenSprache`, `StufenSchrift`, `VoraussetzungKampftechnik`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel } from "@/lib/chargen/types";
import { ATTR_FROM_GERMAN, currentAttrValue } from "@/lib/chargen/types";
import { effectiveTalentTp } from "@/lib/chargen/rules/applyBausteine";
import {
  isCombatTalent,
  MAX_AT_PA_DIFF,
  talentParade,
} from "@/lib/chargen/rules/talentActivation";
import { hasSpellRepresentation } from "@/lib/chargen/rules/sktColumn";
import type { Konflikt } from "@/lib/chargen/rules/voraussetzungen";

const BEGABUNG_TALENT = "VorNachteil.BegabungFuerTalent";
const BEGABUNG_GRUPPE = "VorNachteil.BegabungFuerTalentgruppe";

export function attrCodeFromProbeToken(token: string): string {
  if (token.startsWith("Eigenschaft.")) {
    const code = ATTR_FROM_GERMAN[token];
    if (code) return code;
  }
  const short = token.replace(/^Eigenschaft\./, "").slice(0, 2).toUpperCase();
  const map: Record<string, string> = {
    MU: "CO",
    KL: "CL",
    IN: "IN",
    CH: "CH",
    FF: "DE",
    GE: "AG",
    KO: "CN",
    KK: "ST",
  };
  return map[short] || "CL";
}

/** Java `Eigenschaftsprobe.toString()` — e.g. `(CO/AG/ST)`. */
export function formatTalentProbe(talent: CatalogItem): string {
  const attrs = (talent.test_attributes as string[] | undefined) ?? [];
  if (!attrs.length) return "";
  const codes = attrs.map((t) => {
    if (!t || t === "*" || t === "Eigenschaft.*") return "*";
    return attrCodeFromProbeToken(t);
  });
  while (codes.length < 3) codes.push("*");
  return `(${codes.slice(0, 3).join("/")})`;
}

function maxProbeAttribute(
  held: HeldModel,
  testAttributes: string[],
  attributeMods?: AttributeMods
): number {
  let max = 0;
  for (const token of testAttributes) {
    const code = attrCodeFromProbeToken(token) as Parameters<
      typeof currentAttrValue
    >[1];
    max = Math.max(max, currentAttrValue(held, code, attributeMods));
  }
  return max;
}

function minProbeAttribute(
  held: HeldModel,
  testAttributes: string[],
  attributeMods?: AttributeMods
): number {
  if (!testAttributes.length) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const token of testAttributes) {
    const code = attrCodeFromProbeToken(token) as Parameters<
      typeof currentAttrValue
    >[1];
    min = Math.min(min, currentAttrValue(held, code, attributeMods));
  }
  return min;
}

function hasBegabungForTalent(held: HeldModel, talent: CatalogItem): boolean {
  const talentId = String(talent.id);
  const group = String(talent.group || "");
  return (
    held.advantagesDisadvantages.some(
      (t) => t.id === BEGABUNG_TALENT && t.variant === talentId
    ) ||
    (group !== "" &&
      held.advantagesDisadvantages.some(
        (t) => t.id === BEGABUNG_GRUPPE && t.variant === group
      ))
  );
}

function spellHasMatchingRepresentation(
  held: HeldModel,
  spell: CatalogItem
): boolean {
  const reps = (spell.representations as string[]) || [];
  if (reps.length !== 1) return true;
  return hasSpellRepresentation(held, reps[0]);
}

export function talentHoechststufe(
  held: HeldModel,
  talent: CatalogItem,
  attributeMods?: AttributeMods
): number {
  const attrs = (talent.test_attributes as string[]) || [];
  const probeMax = maxProbeAttribute(held, attrs, attributeMods);
  const bonus = hasBegabungForTalent(held, talent) ? 5 : 3;
  let cap = probeMax + bonus;
  const group = String(talent.group || "");
  if (
    (group === "languages" || group === "scripts") &&
    talent.complexity != null
  ) {
    cap = Math.min(cap, Number(talent.complexity));
  }
  return cap;
}

export function spellHoechststufe(
  held: HeldModel,
  spell: CatalogItem,
  attributeMods?: AttributeMods
): number {
  const attrs = (spell.test_attributes as string[]) || [];
  const reps = (spell.representations as string[]) || [];
  const probe =
    reps.length === 1 && !spellHasMatchingRepresentation(held, spell)
      ? minProbeAttribute(held, attrs, attributeMods)
      : maxProbeAttribute(held, attrs, attributeMods);
  return probe + 3;
}

export function checkTalentLevelCaps(
  held: HeldModel,
  talents: CatalogItem[],
  opts: {
    attributeMods?: AttributeMods;
    resolveName?: (id: string) => string | undefined;
  } = {}
): Konflikt[] {
  const out: Konflikt[] = [];
  for (const row of held.talents) {
    const meta = talents.find((t) => t.id === row.id);
    if (!meta) continue;
    const attrs = (meta.test_attributes as string[]) || [];
    // Without probe attributes Höchststufe collapses to 0+3 — skip until enriched
    if (!attrs.length) continue;
    const tp = effectiveTalentTp(held, row.id, row.tp);
    const cap = talentHoechststufe(held, meta, opts.attributeMods);
    if (tp > cap) {
      const name = opts.resolveName?.(row.id) || (meta.name as string) || row.id;
      out.push({
        code: `talent_cap:${row.id}`,
        message: `${name}: TP ${tp} exceeds maximum level ${cap}.`,
        severity: "warning",
        section: "talents",
      });
    }
  }
  return out;
}

export function checkSpellLevelCaps(
  held: HeldModel,
  spells: CatalogItem[],
  opts: {
    attributeMods?: AttributeMods;
    resolveName?: (id: string) => string | undefined;
  } = {}
): Konflikt[] {
  const out: Konflikt[] = [];
  for (const row of held.spells) {
    const meta = spells.find((s) => s.id === row.id);
    if (!meta) continue;
    const cap = spellHoechststufe(held, meta, opts.attributeMods);
    if (row.sp > cap) {
      const name = opts.resolveName?.(row.id) || (meta.name as string) || row.id;
      out.push({
        code: `spell_cap:${row.id}`,
        message: `${name}: SP ${row.sp} exceeds maximum level ${cap}.`,
        severity: "warning",
        section: "spells",
      });
    }
  }
  return out;
}

export function checkCombatAtPaSpread(
  held: HeldModel,
  talents: CatalogItem[],
  opts: {
    attributeMods?: AttributeMods;
    resolveName?: (id: string) => string | undefined;
  } = {}
): Konflikt[] {
  const out: Konflikt[] = [];
  for (const row of held.talents) {
    const meta = talents.find((t) => t.id === row.id);
    if (!meta || !isCombatTalent(meta)) continue;
    const tp = effectiveTalentTp(held, row.id, row.tp, opts.attributeMods);
    const attack = row.attack ?? 0;
    const parade = talentParade(
      held,
      row.id,
      row.tp,
      attack,
      opts.attributeMods
    );
    const name = opts.resolveName?.(row.id) || (meta.name as string) || row.id;
    if (attack > tp) {
      out.push({
        code: `combat_at_over:${row.id}`,
        message: `${name}: AT ${attack} exceeds TP ${tp}.`,
        severity: "warning",
        section: "talents",
      });
    } else if (Math.abs(attack - parade) > MAX_AT_PA_DIFF) {
      out.push({
        code: `combat_at_pa_spread:${row.id}`,
        message: `${name}: |AT − PA| = ${Math.abs(attack - parade)} (max ${MAX_AT_PA_DIFF}).`,
        severity: "warning",
        section: "talents",
      });
    }
  }
  return out;
}
