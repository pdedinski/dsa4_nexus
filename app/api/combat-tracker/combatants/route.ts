import { NextRequest, NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import {
  resolveActiveCombatant,
  sortCombatantsForDisplay,
} from "@/lib/combat/combatTrackerSort";
import {
  buildTrackerDto,
  ensureUserEncounter,
  findUserEncounter,
  loadCombatants,
  toCombatantDto,
  updateEncounterTurnState,
} from "@/lib/combat/combatTrackerApi";
import { db } from "@/lib/db/client";
import { combatCombatants } from "@/lib/db/schema";

const COMMENT_MAX_LEN = 2000;

function parseIntField(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

function parseComment(v: unknown): string | { error: string } {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return { error: "Comment must be a string" };
  const trimmed = v.trim();
  if (trimmed.length > COMMENT_MAX_LEN) {
    return { error: `Comment must be at most ${COMMENT_MAX_LEN} characters` };
  }
  return trimmed;
}

/** POST — add combatant */
export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const commentResult = parseComment(body.comment);
  if (typeof commentResult === "object") {
    return NextResponse.json({ error: commentResult.error }, { status: 400 });
  }

  const ini = parseIntField(body.ini, 0);
  const vp = parseIntField(body.vp, 0);
  const asp = parseIntField(body.asp, 0);
  const ar = parseIntField(body.ar, 0);
  const wounds = Math.max(0, Math.min(6, parseIntField(body.wounds, 0)));

  const encounter = await ensureUserEncounter(session.user.id);
  const existing = await loadCombatants(encounter.id);
  const maxSort =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((c) => c.sortOrder)) + 1;

  const [created] = await db
    .insert(combatCombatants)
    .values({
      encounterId: encounter.id,
      name,
      ini,
      vp,
      asp,
      ar,
      comment: commentResult,
      wounds,
      actionDone: false,
      sortOrder: maxSort,
      lastDamageApplied: null,
    })
    .returning();

  const all = [...existing, created!].map(toCombatantDto);
  const sorted = sortCombatantsForDisplay(all);
  const activeCombatantId = resolveActiveCombatant(
    encounter.activeCombatantId,
    sorted
  );

  if (activeCombatantId !== encounter.activeCombatantId) {
    await updateEncounterTurnState(
      encounter.id,
      encounter.turnNumber,
      activeCombatantId
    );
  }

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
