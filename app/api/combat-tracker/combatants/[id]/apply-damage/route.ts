import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import {
  getActiveCombatants,
  isActiveCombatant,
  nextActiveAfterRemoval,
} from "@/lib/combat/combatTrackerSort";
import {
  buildTrackerDto,
  clearAllActionDone,
  findOwnedCombatant,
  findUserEncounter,
  loadCombatants,
  toCombatantDto,
  updateEncounterTurnState,
} from "@/lib/combat/combatTrackerApi";
import { db } from "@/lib/db/client";
import { combatCombatants } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await ctx.params;
  const id = decodeURIComponent(rawId);
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "Invalid combatant id" }, { status: 400 });

  const owned = await findOwnedCombatant(session.user.id, id);
  if (!owned)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { damageDealt?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const damageDealt =
    typeof body.damageDealt === "number" && Number.isFinite(body.damageDealt)
      ? Math.trunc(body.damageDealt)
      : typeof body.damageDealt === "string" && body.damageDealt.trim() !== ""
        ? Math.trunc(Number(body.damageDealt))
        : NaN;

  if (!Number.isFinite(damageDealt)) {
    return NextResponse.json(
      { error: "damageDealt must be an integer" },
      { status: 400 }
    );
  }

  const { encounter, combatant } = owned;
  const netDamage = Math.max(0, damageDealt - combatant.ar);
  const newVp = combatant.vp - netDamage;

  const beforeDtos = (await loadCombatants(encounter.id)).map(toCombatantDto);
  const activeBefore = getActiveCombatants(beforeDtos);

  await db
    .update(combatCombatants)
    .set({
      vp: newVp,
      lastDamageApplied: netDamage,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(combatCombatants.id, id),
        eq(combatCombatants.encounterId, encounter.id)
      )
    );

  const afterDtos = (await loadCombatants(encounter.id)).map(toCombatantDto);
  const remainingActive = getActiveCombatants(afterDtos);
  const updated = afterDtos.find((c) => c.id === id)!;

  if (
    encounter.activeCombatantId === id &&
    !isActiveCombatant(updated)
  ) {
    const handoff = nextActiveAfterRemoval(
      id,
      activeBefore,
      remainingActive
    );
    let turn = encounter.turnNumber;
    if (handoff.shouldWrapRound) {
      turn = encounter.turnNumber + 1;
      await clearAllActionDone(encounter.id);
    }
    await updateEncounterTurnState(
      encounter.id,
      turn,
      handoff.activeCombatantId
    );
  }

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
