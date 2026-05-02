import { NextRequest, NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import { generateCharacter } from "@/lib/character/generator";
import type { GenerateCharacterInput } from "@/lib/character/types";

export async function POST(req: NextRequest) {
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
    const sheet = generateCharacter(body);
    return NextResponse.json({ sheet });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
