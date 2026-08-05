import { NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import {
  buildTrackerDto,
  findUserEncounter,
} from "@/lib/combat/combatTrackerApi";

export async function GET() {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const encounter = await findUserEncounter(session.user.id);
  const tracker = await buildTrackerDto(encounter);
  return NextResponse.json(tracker);
}
