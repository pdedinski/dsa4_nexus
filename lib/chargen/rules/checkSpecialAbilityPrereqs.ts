/**
 * Evaluate special-ability Voraussetzung keys against the current hero.
 * Mirrors Java `sonderfertigkeiten.voraussetzungen.Voraussetzung`.
 */

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttrCodeWithSo, HeldModel } from "@/lib/chargen/types";
import { currentAttrValue, derivedValue } from "@/lib/chargen/types";
import { hasSpecialAbility, hasTrait } from "@/lib/chargen/rules/kosten";
import { formatPrerequisite } from "@/lib/chargen/rules/prerequisiteLabels";
import {
  ATTR_FROM_KEY,
  parseAttributePrerequisite,
  parseTalentLevelPrerequisite,
  sfVoraussetzungKeyToId,
  TALENT_KEY_ALIASES,
  TRAIT_KEY_TO_ID,
  TRAIT_OR_PREREQ_KEYS,
} from "@/lib/chargen/rules/prerequisiteKeys";
import type { Konflikt } from "@/lib/chargen/rules/voraussetzungen";
import { effectiveTalentTp } from "@/lib/chargen/rules/applyBausteine";

export {
  ATTR_FROM_KEY,
  sfVoraussetzungKeyToId,
  talentVoraussetzungKeyToId,
} from "@/lib/chargen/rules/prerequisiteKeys";

export function attrWithBausteinMods(
  held: HeldModel,
  code: AttrCodeWithSo,
  mods?: {
    race?: Record<string, number>;
    culture?: Record<string, number>;
    profession?: Record<string, number>;
  }
): number {
  return currentAttrValue(held, code, mods);
}

export interface PrerequisiteFail {
  key: string;
  message: string;
}

/**
 * Returns unmet prerequisites for one special ability.
 * Empty array = all requirements satisfied (or granted / no prereqs).
 */
export function unmetSpecialAbilityPrerequisites(
  held: HeldModel,
  ability: CatalogItem,
  opts: {
    granted?: boolean;
    attributeMods?: {
      race?: Record<string, number>;
      culture?: Record<string, number>;
      profession?: Record<string, number>;
    };
    resolveName?: (id: string) => string | undefined;
    /** Talent bound to this SA instance (specializations / sharpshooter). */
    talentId?: string;
    /** 1-based index among specializations of the same talent (Java getIndex). */
    specializationIndex?: number;
  } = {}
): PrerequisiteFail[] {
  const keys = (ability.prerequisites as string[]) || [];
  if (!keys.length) return [];

  const fails: PrerequisiteFail[] = [];
  const granted = Boolean(opts.granted);

  for (const key of keys) {
    const label = formatPrerequisite(key, opts.resolveName);

    // Acquisition blocks: only relevant when freely selecting (not package-granted)
    if (key === "NICHT_BEGINN" || key === "NICHT_FREI_WAEHLBAR") {
      if (!granted) fails.push({ key, message: label });
      continue;
    }

    if (key === "SPEZIALISIERUNG") {
      const talentId =
        (ability.talent as string) ||
        (opts.talentId as string | undefined);
      if (!talentId) continue;
      const index = Math.max(1, opts.specializationIndex ?? 1);
      const need = 7 * index;
      const row = held.talents.find((t) => t.id === talentId);
      const have = effectiveTalentTp(held, talentId, row?.tp ?? 0);
      if (!row || have < need) {
        fails.push({
          key,
          message: `${opts.resolveName?.(talentId) || talentId} TP ≥ ${need} (have ${have})`,
        });
      }
      continue;
    }

    if (key === "STANDARD" || key === "KULTURKUNDE") {
      continue;
    }

    const attr = parseAttributePrerequisite(key);
    if (attr) {
      const have = attrWithBausteinMods(held, attr.code, opts.attributeMods);
      if (have < attr.need) {
        // Match Java PanelProbleme: "IN ≥ 10" / "CL ≥ 10"
        fails.push({
          key,
          message: `${attr.code} ≥ ${attr.need}`,
        });
      }
      continue;
    }

    if (key === "INITIATIVE_10") {
      const ini = derivedValue(held, "baseINI");
      if (ini < 10) {
        fails.push({
          key,
          message: `INI ≥ 10 (have ${ini})`,
        });
      }
      continue;
    }

    if (key === "PARADE_8") {
      const pa = derivedValue(held, "basePA");
      if (pa < 8) {
        fails.push({
          key,
          message: `base PA ≥ 8 (have ${pa})`,
        });
      }
      continue;
    }

    if (key.startsWith("NICHT_")) {
      const rest = key.slice("NICHT_".length);
      const traitId = TRAIT_KEY_TO_ID[rest];
      if (traitId) {
        if (hasTrait(held, traitId)) {
          fails.push({ key, message: label });
        }
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

    // Advantage/trait requirements (Java VoraussetzungVorteil) — before SF fallthrough
    const traitOr = TRAIT_OR_PREREQ_KEYS[key];
    if (traitOr) {
      if (!traitOr.some((id) => hasTrait(held, id))) {
        const names = traitOr
          .map((id) => opts.resolveName?.(id) || id.replace(/^VorNachteil\./, ""))
          .join(" or ");
        fails.push({
          key,
          message: `Requires ${names}`,
        });
      }
      continue;
    }

    const talentNum = parseTalentLevelPrerequisite(key);
    if (talentNum && !talentNum.steigern) {
      const field = key.split("_")[0];
      const isTalentField =
        Boolean(TALENT_KEY_ALIASES[field]) ||
        /^(RAUFEN|REITEN|RINGEN|KOERPERBEHERRSCHUNG|RITUALKENNTNIS|FAHRZEUG)/.test(
          field
        );
      if (isTalentField) {
        const need = talentNum.need;
        const row = held.talents.find((t) => t.id === talentNum.talentId);
        const have = effectiveTalentTp(held, talentNum.talentId, row?.tp ?? 0);
        if (have < need) {
          fails.push({
            key,
            message: `${opts.resolveName?.(talentNum.talentId) || talentNum.talentId} TP ≥ ${need} (have ${have})`,
          });
        }
        continue;
      }
    }

    const sfId = sfVoraussetzungKeyToId(key);
    if (!hasSpecialAbility(held, sfId)) {
      fails.push({
        key,
        message: `Requires ${opts.resolveName?.(sfId) || label}`,
      });
    }
  }

  return fails;
}

export function checkSpecialAbilityPrerequisites(
  held: HeldModel,
  specials: CatalogItem[],
  opts: {
    attributeMods?: {
      race?: Record<string, number>;
      culture?: Record<string, number>;
      profession?: Record<string, number>;
    };
    grantedIds?: Set<string>;
    resolveName?: (id: string) => string | undefined;
  } = {}
): Konflikt[] {
  const out: Konflikt[] = [];
  for (const owned of held.specialAbilities) {
    const meta =
      specials.find(
        (s) =>
          s.id === owned.id &&
          ((s.talent as string) || "") === (owned.talent || "")
      ) || specials.find((s) => s.id === owned.id);
    if (!meta) continue;
    const granted = opts.grantedIds?.has(owned.id) ?? false;
    const siblings = held.specialAbilities.filter(
      (s) => s.id === owned.id && (s.talent || "") === (owned.talent || "")
    );
    const specializationIndex =
      siblings.findIndex(
        (s) => (s.variant || "") === (owned.variant || "")
      ) + 1;
    const fails = unmetSpecialAbilityPrerequisites(held, meta, {
      granted,
      attributeMods: opts.attributeMods,
      resolveName: opts.resolveName,
      talentId: owned.talent || (meta.talent as string | undefined),
      specializationIndex: specializationIndex || 1,
    });
    for (const f of fails) {
      const abilityName =
        opts.resolveName?.(owned.id) || (meta.name as string) || owned.id;
      const talentBit = owned.talent
        ? ` (${opts.resolveName?.(owned.talent) || owned.talent})`
        : "";
      const variantBit = owned.variant
        ? ` (${opts.resolveName?.(owned.variant) || owned.variant.replace(/^Kulturkunde\./, "")})`
        : "";
      out.push({
        code: `sf_prereq:${owned.id}:${owned.talent || ""}:${owned.variant || ""}:${f.key}`,
        message: `${abilityName}${talentBit}${variantBit}: ${f.message}`,
        // Java: SF prereqs need not be met to select — only to use in play
        severity: "warning",
        section: "special_abilities",
      });
    }
  }
  return out;
}

export function isSpecialAbilitySelectable(
  held: HeldModel,
  ability: CatalogItem,
  opts: {
    granted?: boolean;
    attributeMods?: {
      race?: Record<string, number>;
      culture?: Record<string, number>;
      profession?: Record<string, number>;
    };
    resolveName?: (id: string) => string | undefined;
    talentId?: string;
    specializationIndex?: number;
  } = {}
): { ok: boolean; fails: PrerequisiteFail[] } {
  const fails = unmetSpecialAbilityPrerequisites(held, ability, opts);
  return { ok: fails.length === 0, fails };
}
