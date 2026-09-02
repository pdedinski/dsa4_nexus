import { NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import { advanceActiveCombatant } from "@/lib/combat/combatTrackerSort";
import {
  buildTrackerDto,
  clearAllActionDone,
  clearLastDamageApplied,
  findUserEncounter,
  loadCombatants,
  setCombatantActionDone,
  toCombatantDto,
  updateEncounterTurnState,
} from "@/lib/combat/combatTrackerApi";

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
  const result = advanceActiveCombatant(
    encounter.activeCombatantId,
    dtos,
    encounter.turnNumber
  );

  if (result.markDoneId) {
    await setCombatantActionDone(result.markDoneId, true);
  }

  if (result.clearAllActionDone) {
    await clearAllActionDone(encounter.id);
  }

  await updateEncounterTurnState(
    encounter.id,
    result.turnNumber,
    result.activeCombatantId
  );
  // Hide all (-XX) damage flashes when the current combatant's turn ends
  await clearLastDamageApplied(encounter.id);

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
