/** Shared combat-tracker ordering and turn-advance helpers. */

export const INCAPACITATED_VP_THRESHOLD = 5;

export type CombatantSortable = {
  id: string;
  ini: number;
  vp: number;
  sortOrder: number;
};

export function isActiveCombatant(c: { vp: number }): boolean {
  return c.vp > INCAPACITATED_VP_THRESHOLD;
}

/** Compare two combatants for display order within the same zone (active or incapacitated). */
function compareByIniThenSort(a: CombatantSortable, b: CombatantSortable): number {
  if (b.ini !== a.ini) return b.ini - a.ini; // INI descending
  return a.sortOrder - b.sortOrder;
}

/**
 * Full display order:
 * 1. Active (vp > 5): INI desc, then sortOrder asc
 * 2. Incapacitated (vp ≤ 5): same relative sort, pinned at end
 */
export function sortCombatantsForDisplay<T extends CombatantSortable>(
  combatants: T[]
): T[] {
  const active = combatants
    .filter(isActiveCombatant)
    .slice()
    .sort(compareByIniThenSort);
  const incapacitated = combatants
    .filter((c) => !isActiveCombatant(c))
    .slice()
    .sort(compareByIniThenSort);
  return [...active, ...incapacitated];
}

/** Active combatants only, in display (INI) order. */
export function getActiveCombatants<T extends CombatantSortable>(
  combatants: T[]
): T[] {
  return combatants.filter(isActiveCombatant).slice().sort(compareByIniThenSort);
}

/**
 * Ensure activeCombatantId still refers to an active combatant.
 * Falls back to the first active combatant, or null if none.
 */
export function resolveActiveCombatant(
  activeId: string | null | undefined,
  combatants: CombatantSortable[]
): string | null {
  const active = getActiveCombatants(combatants);
  if (active.length === 0) return null;
  if (activeId && active.some((c) => c.id === activeId)) return activeId;
  return active[0]!.id;
}

/**
 * Advance turn to the next active combatant.
 * When leaving the last active, wrap to first and increment turnNumber.
 */
export function advanceActiveCombatant(
  activeId: string | null | undefined,
  combatants: CombatantSortable[],
  turnNumber: number
): { activeCombatantId: string | null; turnNumber: number; wrapped: boolean } {
  const active = getActiveCombatants(combatants);
  if (active.length === 0) {
    return { activeCombatantId: null, turnNumber, wrapped: false };
  }

  const resolved =
    activeId && active.some((c) => c.id === activeId)
      ? activeId
      : active[0]!.id;

  const idx = active.findIndex((c) => c.id === resolved);
  const nextIdx = idx + 1;

  if (nextIdx >= active.length) {
    return {
      activeCombatantId: active[0]!.id,
      turnNumber: turnNumber + 1,
      wrapped: true,
    };
  }

  return {
    activeCombatantId: active[nextIdx]!.id,
    turnNumber,
    wrapped: false,
  };
}

/**
 * When an active combatant becomes incapacitated or is removed, pick the next
 * active without incrementing turn number. Prefer the combatant that was after
 * the removed one in order; wrap to first without incrementing.
 *
 * @param removedId - combatant that left the active pool
 * @param activeBefore - active list (vp > 5) before the change, in display order
 * @param remainingActive - active list after the change
 */
export function nextActiveAfterRemoval(
  removedId: string,
  activeBefore: CombatantSortable[],
  remainingActive: CombatantSortable[]
): string | null {
  if (remainingActive.length === 0) return null;
  const idx = activeBefore.findIndex((c) => c.id === removedId);
  if (idx < 0) return remainingActive[0]!.id;
  for (let i = idx + 1; i < activeBefore.length; i++) {
    const cand = activeBefore[i]!;
    if (remainingActive.some((c) => c.id === cand.id)) return cand.id;
  }
  return remainingActive[0]!.id;
}

/**
 * Compute sort_order for an INI change relative to peers with the same INI.
 * - INI decreased (moved down / lower in turn order): place before same-INI peers (min−1)
 * - INI increased (moved up): place after same-INI peers (max+1)
 * - Unchanged INI: keep existing sortOrder
 */
export function sortOrderForIniChange(
  combatantId: string,
  oldIni: number,
  newIni: number,
  oldSortOrder: number,
  peers: CombatantSortable[]
): number {
  if (newIni === oldIni) return oldSortOrder;

  const sameIni = peers.filter(
    (c) => c.id !== combatantId && c.ini === newIni
  );

  if (sameIni.length === 0) return oldSortOrder;

  const orders = sameIni.map((c) => c.sortOrder);
  const min = Math.min(...orders);
  const max = Math.max(...orders);

  if (newIni < oldIni) {
    // Moved down in turn order (lower INI) → before others with same INI
    return min - 1;
  }
  // Moved up (higher INI) → after others with same INI
  return max + 1;
}

/**
 * Move a combatant one slot up or down in the active list.
 * Adjusts INI to match the neighbor and sort_order so display order changes
 * even when neighbors have different INI values.
 * Returns updates to apply, or null if move is impossible.
 */
export function moveAdjacentActive(
  combatantId: string,
  direction: "up" | "down",
  combatants: CombatantSortable[]
): { id: string; ini: number; sortOrder: number }[] | null {
  const active = getActiveCombatants(combatants);
  const idx = active.findIndex((c) => c.id === combatantId);
  if (idx < 0) return null;

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= active.length) return null;

  const self = active[idx]!;
  const neighbor = active[targetIdx]!;

  if (direction === "up") {
    // Appear before neighbor (earlier in turn order)
    return [
      {
        id: self.id,
        ini: neighbor.ini,
        sortOrder: neighbor.sortOrder - 1,
      },
    ];
  }

  // Appear after neighbor (later in turn order)
  return [
    {
      id: self.id,
      ini: neighbor.ini,
      sortOrder: neighbor.sortOrder + 1,
    },
  ];
}
