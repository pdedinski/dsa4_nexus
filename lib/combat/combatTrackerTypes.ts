/** Shared combat-tracker DTO types (safe for client + server). */

export type CombatantDto = {
  id: string;
  name: string;
  ini: number;
  vp: number;
  asp: number;
  ar: number;
  sortOrder: number;
  lastDamageApplied: number | null;
};

export type CombatTrackerDto = {
  turnNumber: number;
  activeCombatantId: string | null;
  combatants: CombatantDto[];
};
