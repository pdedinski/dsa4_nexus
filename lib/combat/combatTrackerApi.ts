import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  combatCombatants,
  combatEncounters,
  type CombatCombatantRow,
  type CombatEncounterRow,
} from "@/lib/db/schema";
import {
  resolveActiveCombatant,
  sortCombatantsForDisplay,
} from "@/lib/combat/combatTrackerSort";
import type {
  CombatantDto,
  CombatTrackerDto,
} from "@/lib/combat/combatTrackerTypes";

export type { CombatantDto, CombatTrackerDto };

export function toCombatantDto(row: CombatCombatantRow): CombatantDto {
  return {
    id: row.id,
    name: row.name,
    ini: row.ini,
    vp: row.vp,
    asp: row.asp,
    ar: row.ar,
    comment: row.comment ?? "",
    wounds: row.wounds ?? 0,
    actionDone: row.actionDone ?? false,
    sortOrder: row.sortOrder,
    lastDamageApplied: row.lastDamageApplied,
  };
}

export async function findUserEncounter(
  userId: string
): Promise<CombatEncounterRow | null> {
  const [row] = await db
    .select()
    .from(combatEncounters)
    .where(eq(combatEncounters.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function ensureUserEncounter(
  userId: string
): Promise<CombatEncounterRow> {
  const existing = await findUserEncounter(userId);
  if (existing) return existing;

  const [created] = await db
    .insert(combatEncounters)
    .values({ userId, turnNumber: 1, activeCombatantId: null })
    .returning();
  return created!;
}

export async function loadCombatants(
  encounterId: string
): Promise<CombatCombatantRow[]> {
  return db
    .select()
    .from(combatCombatants)
    .where(eq(combatCombatants.encounterId, encounterId));
}

export async function buildTrackerDto(
  encounter: CombatEncounterRow | null
): Promise<CombatTrackerDto> {
  if (!encounter) {
    return { turnNumber: 1, activeCombatantId: null, combatants: [] };
  }

  const rows = await loadCombatants(encounter.id);
  const sorted = sortCombatantsForDisplay(rows.map(toCombatantDto));
  const activeCombatantId = resolveActiveCombatant(
    encounter.activeCombatantId,
    sorted
  );

  // Persist resolved active if it drifted (e.g. first load with null + combatants)
  if (activeCombatantId !== encounter.activeCombatantId) {
    await db
      .update(combatEncounters)
      .set({
        activeCombatantId,
        updatedAt: new Date(),
      })
      .where(eq(combatEncounters.id, encounter.id));
  }

  return {
    turnNumber: encounter.turnNumber,
    activeCombatantId,
    combatants: sorted,
  };
}

export async function findOwnedCombatant(
  userId: string,
  combatantId: string
): Promise<{
  encounter: CombatEncounterRow;
  combatant: CombatCombatantRow;
} | null> {
  const encounter = await findUserEncounter(userId);
  if (!encounter) return null;

  const [combatant] = await db
    .select()
    .from(combatCombatants)
    .where(
      and(
        eq(combatCombatants.id, combatantId),
        eq(combatCombatants.encounterId, encounter.id)
      )
    )
    .limit(1);

  if (!combatant) return null;
  return { encounter, combatant };
}

export async function updateEncounterTurnState(
  encounterId: string,
  turnNumber: number,
  activeCombatantId: string | null
): Promise<void> {
  await db
    .update(combatEncounters)
    .set({
      turnNumber,
      activeCombatantId,
      updatedAt: new Date(),
    })
    .where(eq(combatEncounters.id, encounterId));
}

/** Clear per-row damage flash indicators (shown next to VP until turn ends). */
export async function clearLastDamageApplied(
  encounterId: string
): Promise<void> {
  await db
    .update(combatCombatants)
    .set({
      lastDamageApplied: null,
      updatedAt: new Date(),
    })
    .where(eq(combatCombatants.encounterId, encounterId));
}

/** Clear all action-done flags (Start Combat / new round). */
export async function clearAllActionDone(encounterId: string): Promise<void> {
  await db
    .update(combatCombatants)
    .set({
      actionDone: false,
      updatedAt: new Date(),
    })
    .where(eq(combatCombatants.encounterId, encounterId));
}

/** Mark a single combatant as having taken their action this round. */
export async function setCombatantActionDone(
  combatantId: string,
  actionDone: boolean
): Promise<void> {
  await db
    .update(combatCombatants)
    .set({
      actionDone,
      updatedAt: new Date(),
    })
    .where(eq(combatCombatants.id, combatantId));
}
