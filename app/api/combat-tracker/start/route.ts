import { NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import { getActiveCombatants } from "@/lib/combat/combatTrackerSort";
import {
  buildTrackerDto,
  clearLastDamageApplied,
  findUserEncounter,
  loadCombatants,
  toCombatantDto,
  updateEncounterTurnState,
} from "@/lib/combat/combatTrackerApi";

/**
 * Start Combat: turn_number = 1, green tick on first active combatant (top of list).
 * Does not delete combatants.
 */
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

  const dtos = (await loadCombatants(encounter.id)).map(toCombatantDto);
  const active = getActiveCombatants(dtos);
  const firstActiveId = active[0]?.id ?? null;

  await updateEncounterTurnState(encounter.id, 1, firstActiveId);
  await clearLastDamageApplied(encounter.id);

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
