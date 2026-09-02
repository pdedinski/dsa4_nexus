/** Shared combat-tracker ordering and turn-advance helpers. */

export const INCAPACITATED_VP_THRESHOLD = 5;

export type CombatantSortable = {
  id: string;
  ini: number;
  vp: number;
  sortOrder: number;
  wounds?: number;
  actionDone?: boolean;
};

/** Base INI minus 2 per wound marker. */
export function effectiveIni(c: {
  ini: number;
  wounds?: number;
}): number {
  return c.ini - (c.wounds ?? 0) * 2;
}

export function isActiveCombatant(c: { vp: number }): boolean {
  return c.vp > INCAPACITATED_VP_THRESHOLD;
}

/** Compare two combatants for display order within the same zone (active or incapacitated). */
function compareByIniThenSort(a: CombatantSortable, b: CombatantSortable): number {
  const aIni = effectiveIni(a);
  const bIni = effectiveIni(b);
  if (bIni !== aIni) return bIni - aIni; // effective INI descending
  return a.sortOrder - b.sortOrder;
}

/**
 * Full display order:
 * 1. Active (vp > 5): effective INI desc, then sortOrder asc
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

/** Active combatants only, in display (effective INI) order. */
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
 * Advance turn: mark current as actionDone, then pick the first active
 * combatant whose actionDone is still false (in current effective-INI order).
 * If none remain, wrap: clear all actionDone, increment turnNumber, point at first.
 */
export function advanceActiveCombatant(
  activeId: string | null | undefined,
  combatants: CombatantSortable[],
  turnNumber: number
): {
  activeCombatantId: string | null;
  turnNumber: number;
  wrapped: boolean;
  /** Combatant id that should be marked actionDone (current before advance). */
  markDoneId: string | null;
  /** When true, clear actionDone on all combatants (new round). */
  clearAllActionDone: boolean;
} {
  const active = getActiveCombatants(combatants);
  if (active.length === 0) {
    return {
      activeCombatantId: null,
      turnNumber,
      wrapped: false,
      markDoneId: null,
      clearAllActionDone: false,
    };
  }

  const resolved =
    activeId && active.some((c) => c.id === activeId)
      ? activeId
      : active[0]!.id;

  // After marking current done, who still needs an action?
  const stillPending = active.filter(
    (c) => c.id !== resolved && !c.actionDone
  );

  if (stillPending.length === 0) {
    return {
      activeCombatantId: active[0]!.id,
      turnNumber: turnNumber + 1,
      wrapped: true,
      markDoneId: resolved,
      clearAllActionDone: true,
    };
  }

  return {
    activeCombatantId: stillPending[0]!.id,
    turnNumber,
    wrapped: false,
    markDoneId: resolved,
    clearAllActionDone: false,
  };
}

/**
 * When an active combatant becomes incapacitated or is removed, pick the next
 * unsigned active combatant. Prefer someone after the removed one in order;
 * if none remain unsigned, signal a round wrap.
 */
export function nextActiveAfterRemoval(
  removedId: string,
  activeBefore: CombatantSortable[],
  remainingActive: CombatantSortable[]
): {
  activeCombatantId: string | null;
  /** True when every remaining active combatant has already acted. */
  shouldWrapRound: boolean;
} {
  if (remainingActive.length === 0) {
    return { activeCombatantId: null, shouldWrapRound: false };
  }

  const pending = remainingActive.filter((c) => !c.actionDone);
  if (pending.length === 0) {
    return {
      activeCombatantId: remainingActive[0]!.id,
      shouldWrapRound: true,
    };
  }

  const idx = activeBefore.findIndex((c) => c.id === removedId);
  if (idx >= 0) {
    for (let i = idx + 1; i < activeBefore.length; i++) {
      const cand = activeBefore[i]!;
      if (pending.some((c) => c.id === cand.id)) {
        return { activeCombatantId: cand.id, shouldWrapRound: false };
      }
    }
  }

  return { activeCombatantId: pending[0]!.id, shouldWrapRound: false };
}

/**
 * Compute sort_order for an (effective) INI change relative to peers with the
 * same effective INI.
 * - INI decreased: place before same-INI peers (min−1)
 * - INI increased: place after same-INI peers (max+1)
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
    (c) => c.id !== combatantId && effectiveIni(c) === newIni
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
 * Adjusts base INI to match the neighbor's *effective* INI (accounting for
 * self wounds) and sort_order so display order changes even when neighbors
 * have different effective INI values.
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
  const neighborEff = effectiveIni(neighbor);
  // Set base INI so effectiveIni(self) equals neighbor's effective INI
  const newBaseIni = neighborEff + (self.wounds ?? 0) * 2;

  if (direction === "up") {
    // Appear before neighbor (earlier in turn order)
    return [
      {
        id: self.id,
        ini: newBaseIni,
        sortOrder: neighbor.sortOrder - 1,
      },
    ];
  }

  // Appear after neighbor (later in turn order)
  return [
    {
      id: self.id,
      ini: newBaseIni,
      sortOrder: neighbor.sortOrder + 1,
    },
  ];
}
