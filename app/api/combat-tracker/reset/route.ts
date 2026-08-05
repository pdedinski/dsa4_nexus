import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import {
  buildTrackerDto,
  findUserEncounter,
} from "@/lib/combat/combatTrackerApi";
import { db } from "@/lib/db/client";
import { combatCombatants, combatEncounters } from "@/lib/db/schema";

/** Full reset: delete all combatants, turn_number = 1, clear active. */
export async function POST() {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const encounter = await findUserEncounter(session.user.id);
  if (!encounter) {
    return NextResponse.json({
      turnNumber: 1,
      activeCombatantId: null,
      combatants: [],
    });
  }

  // Clear active first so FK SET NULL is not relied on mid-delete
  await db
    .update(combatEncounters)
    .set({
      activeCombatantId: null,
      turnNumber: 1,
      updatedAt: new Date(),
    })
    .where(eq(combatEncounters.id, encounter.id));

  await db
    .delete(combatCombatants)
    .where(eq(combatCombatants.encounterId, encounter.id));

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
