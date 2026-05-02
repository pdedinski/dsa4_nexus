import { NextRequest, NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import { listSpellsForWizard } from "@/lib/character/generator";

export async function GET(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raceId = req.nextUrl.searchParams.get("raceId") ?? "";
  const professionId = req.nextUrl.searchParams.get("professionId") ?? "";
  const halfElfFullCaster =
    req.nextUrl.searchParams.get("halfElfFullCaster") === "true";

  if (!raceId || !professionId)
    return NextResponse.json(
      { error: "Missing raceId or professionId" },
      { status: 400 }
    );

  const spells = listSpellsForWizard(raceId, professionId, halfElfFullCaster);
  return NextResponse.json({ spells });
}
