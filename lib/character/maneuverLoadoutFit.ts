/**
 * Map combat-maneuver compatible_talents shorthands onto catalog combat talent ids,
 * and test whether a special ability fits the wizard weapon loadout.
 */

import combatManeuvers from "@/data/combat/combat_maneuvers.json";
import { ALL_TALENT_IDS, TALENT_INDEX } from "@/lib/talents/catalog";

/** SA catalog id → maneuver entry id(s) used for compatible_talents. */
const SA_TO_MANEUVER_IDS: Record<string, string[]> = {
  feint_sa: ["feint"],
  called_attack_sa: ["called_attack"],
  formation: ["formation_parry"],
  master_parry: ["master_parry"],
  sharpshooter: [], // ranged SA; fit by linked ranged talents below
  lunge: ["lunge"],
  blade_storm_sa: ["blade_storm"],
  knockdown_sa: ["knockdown"],
  charge_sa: ["charge"],
  stun_blow_sa: ["stun_blow"],
  targeted_thrust_sa: ["targeted_thrust"],
  hammer_strike_sa: ["hammer_strike"],
  double_attack_sa: ["double_attack"],
};

/** Maneuver talent tokens that differ from TALENT_INDEX ids. */
const TALENT_TOKEN_ALIASES: Record<string, string> = {
  bastard_swords: "bastard_sword",
  two_handed_blunt: "two_handed_blunt_weapons",
  sabers_limited: "sabers",
  swords_with_half_sword_sa: "swords",
  shields: "infantry_weapons", // formation often with shields; infantry is the closest melee technique
};

const MELEE_ARMED_IDS = ALL_TALENT_IDS.filter((id) => {
  const d = TALENT_INDEX.get(id);
  return (
    d?.group === "combat_talents" &&
    (d.combat_type === "melee" || d.combat_type === "jousting") &&
    id !== "brawling" &&
    id !== "wrestling"
  );
});

const MELEE_EXCEPT_CHAIN_AND_2H_BLUNT = MELEE_ARMED_IDS.filter(
  (id) => id !== "chain_weapons" && id !== "two_handed_blunt_weapons",
);

const MELEE_EXCEPT_CHAIN_AND_FLAILS = MELEE_ARMED_IDS.filter(
  (id) => id !== "chain_weapons" && id !== "two_handed_flails",
);

const ONE_HANDED_EXCEPT_CHAIN_AND_SPEARS = MELEE_ARMED_IDS.filter(
  (id) =>
    id !== "chain_weapons" &&
    id !== "spears" &&
    id !== "two_handed_swords" &&
    id !== "two_handed_blunt_weapons" &&
    id !== "two_handed_flails" &&
    id !== "bastard_sword" &&
    id !== "infantry_weapons" &&
    id !== "staves" &&
    id !== "jousting",
);

const RANGED_TALENT_IDS = ALL_TALENT_IDS.filter((id) => {
  const d = TALENT_INDEX.get(id);
  return d?.group === "combat_talents" && d.combat_type === "ranged";
});

type ManeuverLike = {
  id?: string;
  compatible_talents?: string[];
};

function allManeuverEntries(): ManeuverLike[] {
  const root = combatManeuvers as Record<string, unknown>;
  const out: ManeuverLike[] = [];
  for (const key of Object.keys(root)) {
    const v = root[key];
    if (!Array.isArray(v)) continue;
    for (const item of v) {
      if (item && typeof item === "object" && "id" in item) {
        out.push(item as ManeuverLike);
      }
    }
  }
  return out;
}

const MANEUVER_BY_ID = new Map(
  allManeuverEntries()
    .filter((m) => typeof m.id === "string")
    .map((m) => [m.id!, m]),
);

function expandTalentToken(token: string): string[] {
  const t = token.trim();
  if (!t) return [];
  if (t === "all_melee" || t === "all_armed_melee") return [...MELEE_ARMED_IDS];
  if (t === "all_ranged") return [...RANGED_TALENT_IDS];
  if (t === "all_armed_melee_except_chain_weapons_and_two_handed_blunt") {
    return [...MELEE_EXCEPT_CHAIN_AND_2H_BLUNT];
  }
  if (t === "all_melee_except_chain_weapons_and_two_handed_flails") {
    return [...MELEE_EXCEPT_CHAIN_AND_FLAILS];
  }
  if (t === "all_one_handed_except_chain_weapons_and_spears") {
    return [...ONE_HANDED_EXCEPT_CHAIN_AND_SPEARS];
  }
  if (t.startsWith("all_")) return [...MELEE_ARMED_IDS];
  const aliased = TALENT_TOKEN_ALIASES[t] ?? t;
  if (TALENT_INDEX.has(aliased)) return [aliased];
  return [];
}

/** Expand a maneuver's compatible_talents list to concrete talent ids. */
export function expandCompatibleTalentIds(
  tokens: readonly string[] | undefined,
): Set<string> {
  const out = new Set<string>();
  if (!tokens?.length) return out;
  for (const tok of tokens) {
    for (const id of expandTalentToken(tok)) out.add(id);
  }
  return out;
}

/**
 * True when the SA's maneuver (or ranged rule) overlaps the wizard-linked combat talents.
 * Empty loadout → false (do not guess weapons).
 */
export function saFitsWeaponLoadout(
  saId: string,
  linkedCombatTalentIds: ReadonlySet<string>,
): boolean {
  if (linkedCombatTalentIds.size === 0) return false;

  if (saId === "sharpshooter") {
    return [...linkedCombatTalentIds].some((id) => {
      const d = TALENT_INDEX.get(id);
      return d?.combat_type === "ranged";
    });
  }

  if (saId === "combat_reflexes") {
    // General combat SA; fit if any melee loadout talent exists.
    return [...linkedCombatTalentIds].some((id) => {
      const d = TALENT_INDEX.get(id);
      return (
        d?.group === "combat_talents" &&
        (d.combat_type === "melee" || d.combat_type === "jousting")
      );
    });
  }

  const maneuverIds = SA_TO_MANEUVER_IDS[saId];
  if (!maneuverIds || maneuverIds.length === 0) return false;

  for (const mid of maneuverIds) {
    const man = MANEUVER_BY_ID.get(mid);
    if (!man) continue;
    const allowed = expandCompatibleTalentIds(man.compatible_talents);
    if (allowed.size === 0) continue;
    for (const tid of linkedCombatTalentIds) {
      if (allowed.has(tid)) return true;
    }
  }
  return false;
}

/** Root maneuver SAs the generator may seed (not chain upgrades). */
export const MANEUVER_ROOT_ALLOWLIST = [
  "feint_sa",
  "called_attack_sa",
  "formation",
  "master_parry",
] as const;

export type ManeuverRootAllowId = (typeof MANEUVER_ROOT_ALLOWLIST)[number];
