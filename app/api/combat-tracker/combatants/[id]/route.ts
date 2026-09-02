import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import {
  effectiveIni,
  getActiveCombatants,
  isActiveCombatant,
  nextActiveAfterRemoval,
  resolveActiveCombatant,
  sortOrderForIniChange,
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
import { MAX_WOUNDS } from "@/lib/combat/combatTrackerTypes";
import { db } from "@/lib/db/client";
import { combatCombatants } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMMENT_MAX_LEN = 2000;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

function parseOptionalInt(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return undefined;
}

function parseOptionalComment(
  v: unknown
): string | undefined | { error: string } {
  if (v === undefined) return undefined;
  if (typeof v !== "string") return { error: "Comment must be a string" };
  const trimmed = v.trim();
  if (trimmed.length > COMMENT_MAX_LEN) {
    return { error: `Comment must be at most ${COMMENT_MAX_LEN} characters` };
  }
  return trimmed;
}

async function applyRemovalHandoff(
  encounterId: string,
  turnNumber: number,
  removedId: string,
  activeBefore: ReturnType<typeof getActiveCombatants>,
  remainingActive: ReturnType<typeof getActiveCombatants>,
  currentActiveId: string | null
): Promise<void> {
  if (currentActiveId !== removedId) return;

  const handoff = nextActiveAfterRemoval(
    removedId,
    activeBefore,
    remainingActive
  );

  let turn = turnNumber;
  if (handoff.shouldWrapRound) {
    turn = turnNumber + 1;
    await clearAllActionDone(encounterId);
  }

  await updateEncounterTurnState(
    encounterId,
    turn,
    handoff.activeCombatantId
  );
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await ctx.params;
  const id = decodeURIComponent(rawId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid combatant id" }, { status: 400 });

  const owned = await findOwnedCombatant(session.user.id, id);
  if (!owned)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: {
    name?: unknown;
    ini?: unknown;
    vp?: unknown;
    asp?: unknown;
    ar?: unknown;
    comment?: unknown;
    wounds?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { encounter, combatant } = owned;
  const updates: {
    name?: string;
    ini?: number;
    vp?: number;
    asp?: number;
    ar?: number;
    comment?: string;
    wounds?: number;
    sortOrder?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name)
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    updates.name = name;
  }

  const commentResult = parseOptionalComment(body.comment);
  if (typeof commentResult === "object") {
    return NextResponse.json({ error: commentResult.error }, { status: 400 });
  }
  if (commentResult !== undefined) updates.comment = commentResult;

  const newIni = parseOptionalInt(body.ini);
  const newVp = parseOptionalInt(body.vp);
  const newAsp = parseOptionalInt(body.asp);
  const newAr = parseOptionalInt(body.ar);
  const rawWounds = parseOptionalInt(body.wounds);
  const newWounds =
    rawWounds !== undefined
      ? Math.max(0, Math.min(MAX_WOUNDS, rawWounds))
      : undefined;

  if (newAsp !== undefined) updates.asp = newAsp;
  if (newAr !== undefined) updates.ar = newAr;
  if (newVp !== undefined) updates.vp = newVp;
  if (newWounds !== undefined) updates.wounds = newWounds;

  const peers = (await loadCombatants(encounter.id)).map(toCombatantDto);
  const oldEff = effectiveIni({
    ini: combatant.ini,
    wounds: combatant.wounds ?? 0,
  });
  const nextBaseIni = newIni !== undefined ? newIni : combatant.ini;
  const nextWounds =
    newWounds !== undefined ? newWounds : (combatant.wounds ?? 0);
  const newEff = effectiveIni({ ini: nextBaseIni, wounds: nextWounds });

  if (newIni !== undefined) updates.ini = newIni;

  if (newEff !== oldEff) {
    updates.sortOrder = sortOrderForIniChange(
      combatant.id,
      oldEff,
      newEff,
      combatant.sortOrder,
      peers
    );
  }

  const beforeDtos = peers;
  const activeBefore = getActiveCombatants(beforeDtos);

  await db
    .update(combatCombatants)
    .set(updates)
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
    await applyRemovalHandoff(
      encounter.id,
      encounter.turnNumber,
      id,
      activeBefore,
      remainingActive,
      encounter.activeCombatantId
    );
  } else {
    const activeId = resolveActiveCombatant(
      encounter.activeCombatantId,
      afterDtos
    );
    if (activeId !== encounter.activeCombatantId) {
      await updateEncounterTurnState(
        encounter.id,
        encounter.turnNumber,
        activeId
      );
    }
  }

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await ctx.params;
  const id = decodeURIComponent(rawId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid combatant id" }, { status: 400 });

  const owned = await findOwnedCombatant(session.user.id, id);
  if (!owned)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { encounter } = owned;
  const before = (await loadCombatants(encounter.id)).map(toCombatantDto);
  const activeBefore = getActiveCombatants(before);

  await db
    .delete(combatCombatants)
    .where(
      and(
        eq(combatCombatants.id, id),
        eq(combatCombatants.encounterId, encounter.id)
      )
    );

  const after = before.filter((c) => c.id !== id);
  const remainingActive = getActiveCombatants(after);

  if (encounter.activeCombatantId === id) {
    await applyRemovalHandoff(
      encounter.id,
      encounter.turnNumber,
      id,
      activeBefore,
      remainingActive,
      encounter.activeCombatantId
    );
  } else {
    const activeId = resolveActiveCombatant(encounter.activeCombatantId, after);
    await updateEncounterTurnState(
      encounter.id,
      encounter.turnNumber,
      activeId
    );
  }

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
