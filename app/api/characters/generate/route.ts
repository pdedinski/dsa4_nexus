import { NextRequest, NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import { generateCharacter } from "@/lib/character/generator";
import { resolveApSpendingProfileForGenerate } from "@/lib/character/resolveApProfile";
import type { GenerateCharacterInput } from "@/lib/character/types";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAllowed();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: GenerateCharacterInput;
    try {
      body = (await req.json()) as GenerateCharacterInput;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      const { resolvedApSpendingProfile: _discard, ...rest } = body;
      const resolvedApSpendingProfile = await resolveApSpendingProfileForGenerate(
        rest.apProfileId
      );
      const debugMode = Boolean(body.debugMode) && session.user.isSuperuser;
      const sheet = generateCharacter({
        ...rest,
        resolvedApSpendingProfile,
        debugMode,
      });
      return NextResponse.json({ sheet });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (e) {
    console.error("[api/characters/generate]", e);
    const msg = e instanceof Error ? e.message : "Server error during generation";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
