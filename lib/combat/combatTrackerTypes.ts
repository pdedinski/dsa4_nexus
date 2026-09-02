/** Shared combat-tracker DTO types (safe for client + server). */

export type CombatantDto = {
  id: string;
  name: string;
  ini: number;
  vp: number;
  asp: number;
  ar: number;
  comment: string;
  /** Wound markers 0–6; each reduces effective INI by 2. */
  wounds: number;
  /** True after this combatant has taken their action this round. */
  actionDone: boolean;
  sortOrder: number;
  lastDamageApplied: number | null;
};

export type CombatTrackerDto = {
  turnNumber: number;
  activeCombatantId: string | null;
  combatants: CombatantDto[];
};

export const MAX_WOUNDS = 6;
