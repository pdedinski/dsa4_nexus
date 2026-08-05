import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { moveAdjacentActive } from "@/lib/combat/combatTrackerSort";
import {
  buildTrackerDto,
  findOwnedCombatant,
  findUserEncounter,
  loadCombatants,
  toCombatantDto,
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

  let body: { direction?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const direction = body.direction;
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json(
      { error: 'direction must be "up" or "down"' },
      { status: 400 }
    );
  }

  const { encounter } = owned;
  const dtos = (await loadCombatants(encounter.id)).map(toCombatantDto);
  const updates = moveAdjacentActive(id, direction, dtos);
  if (!updates) {
    return NextResponse.json(
      { error: "Cannot move in that direction" },
      { status: 400 }
    );
  }

  const now = new Date();
  for (const u of updates) {
    await db
      .update(combatCombatants)
      .set({ ini: u.ini, sortOrder: u.sortOrder, updatedAt: now })
      .where(eq(combatCombatants.id, u.id));
  }

  const refreshed = await findUserEncounter(session.user.id);
  return NextResponse.json(await buildTrackerDto(refreshed));
}
