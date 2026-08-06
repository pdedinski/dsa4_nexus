/**
 * Talent-level Voraussetzung checks (activation, steigern-over-10, trait blocks).
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel } from "@/lib/chargen/types";
import { effectiveTalentTp } from "@/lib/chargen/rules/applyBausteine";
import { formatPrerequisite } from "@/lib/chargen/rules/prerequisiteLabels";
import {
  OR_TALENT_PREREQ_KEYS,
  parseTalentLevelPrerequisite,
  sfVoraussetzungKeyToId,
  talentVoraussetzungKeyToId,
  TRAIT_KEY_TO_ID,
  TRAIT_OR_PREREQ_KEYS,
} from "@/lib/chargen/rules/prerequisiteKeys";
import {
  isTalentActivated,
  isTalentOnHeld,
} from "@/lib/chargen/rules/talentActivation";
import { hasSpecialAbility, hasTrait } from "@/lib/chargen/rules/kosten";
import type { Konflikt } from "@/lib/chargen/rules/voraussetzungen";

export interface TalentPrerequisiteFail {
  key: string;
  message: string;
}

function talentTp(held: HeldModel, talentId: string): number {
  const row = held.talents.find((t) => t.id === talentId);
  return effectiveTalentTp(held, talentId, row?.tp ?? 0);
}

function anyScriptAtLevel(
  held: HeldModel,
  talents: CatalogItem[],
  need: number
): boolean {
  return talents
    .filter((t) => t.group === "scripts")
    .some((meta) => talentTp(held, String(meta.id)) >= need);
}

function anyOrTalentsAtLevel(
  held: HeldModel,
  talentIds: string[],
  need: number
): boolean {
  return talentIds.some((id) => talentTp(held, id) >= need);
}

export function unmetTalentPrerequisites(
  held: HeldModel,
  talent: CatalogItem,
  talents: CatalogItem[],
  opts: {
    seededIds?: Set<string>;
    resolveName?: (id: string) => string | undefined;
  } = {}
): TalentPrerequisiteFail[] {
  const keys = (talent.prerequisites as string[]) || [];
  if (!keys.length) return [];

  const seededIds = opts.seededIds ?? new Set<string>();
  const row = held.talents.find((t) => t.id === talent.id);
  const onHeld = Boolean(row);
  const activated =
    onHeld && isTalentActivated(held, talent, seededIds);
  const ownTp = row ? effectiveTalentTp(held, row.id, row.tp) : 0;
  const fails: TalentPrerequisiteFail[] = [];

  for (const key of keys) {
    if (key === "KAMPFTECHNIK") continue;

    const label = formatPrerequisite(key, opts.resolveName);

    if (key === "NICHT_FREI_WAEHLBAR") {
      if (onHeld) {
        fails.push({ key, message: label });
      }
      continue;
    }

    if (key.startsWith("NICHT_")) {
      const rest = key.slice("NICHT_".length);
      const traitId = TRAIT_KEY_TO_ID[rest];
      if (traitId && hasTrait(held, traitId)) {
        fails.push({ key, message: label });
        continue;
      }
      const sfId = sfVoraussetzungKeyToId(rest);
      if (hasSpecialAbility(held, sfId)) {
        fails.push({
          key,
          message: `Cannot combine with ${opts.resolveName?.(sfId) || sfId}`,
        });
      }
      continue;
    }

    if (key === "SCHRIFT_4") {
      if ((!onHeld || activated) && !anyScriptAtLevel(held, talents, 4)) {
        fails.push({
          key,
          message: "Requires any script at TP ≥ 4",
        });
      }
      continue;
    }

    if (key === "SCHRIFT_6_STEIGERN") {
      if (onHeld && ownTp > 10 && !anyScriptAtLevel(held, talents, 6)) {
        fails.push({
          key,
          message: "Requires any script at TP ≥ 6 (when this talent exceeds 10)",
        });
      }
      continue;
    }

    const orKey = OR_TALENT_PREREQ_KEYS[key];
    if (orKey) {
      if (onHeld && (!orKey.steigern || ownTp > 10)) {
        if (!anyOrTalentsAtLevel(held, orKey.talentIds, orKey.need)) {
          const names = orKey.talentIds
            .map((id) => opts.resolveName?.(id) || id)
            .join(" or ");
          fails.push({
            key,
            message: `Requires ${names} TP ≥ ${orKey.need}${
              orKey.steigern ? " (when this talent exceeds 10)" : ""
            }`,
          });
        }
      }
      continue;
    }

    // Advantage required to take gift talents (Java VoraussetzungVorteil)
    const traitOr = TRAIT_OR_PREREQ_KEYS[key];
    if (traitOr) {
      if ((!onHeld || activated) && !traitOr.some((id) => hasTrait(held, id))) {
        const names = traitOr
          .map((id) => opts.resolveName?.(id) || id.replace(/^VorNachteil\./, ""))
          .join(" or ");
        fails.push({ key, message: `Requires ${names}` });
      }
      continue;
    }

    const parsed = parseTalentLevelPrerequisite(key);
    if (parsed) {
      const relatedTp = talentTp(held, parsed.talentId);
      if (parsed.steigern) {
        if (onHeld && ownTp > 10 && relatedTp < parsed.need) {
          fails.push({
            key,
            message: `${opts.resolveName?.(parsed.talentId) || parsed.talentId} TP ≥ ${parsed.need} (have ${relatedTp}; required when this talent exceeds 10)`,
          });
        }
      } else if ((!onHeld || activated) && relatedTp < parsed.need) {
        fails.push({
          key,
          message: `${opts.resolveName?.(parsed.talentId) || parsed.talentId} TP ≥ ${parsed.need} (have ${relatedTp})`,
        });
      }
      continue;
    }

    // Unknown key — surface label only when talent is active on hero
    if (onHeld && activated) {
      fails.push({ key, message: label });
    }
  }

  return fails;
}

export function checkTalentPrerequisites(
  held: HeldModel,
  talents: CatalogItem[],
  opts: {
    seededIds?: Set<string>;
    resolveName?: (id: string) => string | undefined;
  } = {}
): Konflikt[] {
  const out: Konflikt[] = [];
  for (const meta of talents) {
    if (!isTalentOnHeld(held, String(meta.id))) continue;
    const fails = unmetTalentPrerequisites(held, meta, talents, opts);
    const name = opts.resolveName?.(String(meta.id)) || (meta.name as string) || String(meta.id);
    for (const f of fails) {
      out.push({
        code: `talent_prereq:${meta.id}:${f.key}`,
        message: `${name}: ${f.message}`,
        severity: "warning",
        section: "talents",
      });
    }
  }
  return out;
}

export { talentVoraussetzungKeyToId };
