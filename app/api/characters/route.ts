import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq, desc, asc, and } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";
import type { CharacterSheet } from "@/lib/character/types";
import { migrateCharacterSheet } from "@/lib/character/sheetMigration";
import { sanitizeCharacterSheetForStorage } from "@/lib/character/sheetPersistence";

export async function GET(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sort = req.nextUrl.searchParams.get("sort") ?? "created";
  const order =
    sort === "name"
      ? asc(characters.name)
      : desc(characters.createdAt);

  const rows = await db
    .select({
      id: characters.id,
      characterId: characters.characterId,
      name: characters.name,
      createdAt: characters.createdAt,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .where(eq(characters.userId, session.user.id))
    .orderBy(order);

  return NextResponse.json({ characters: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { characterId?: string; name?: string; sheet?: CharacterSheet };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const characterId = (body.characterId ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const sheet = body.sheet;

  if (!characterId || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(characterId))
    return NextResponse.json(
      { error: "Invalid character_id (use lowercase letters, digits, _ -)" },
      { status: 400 }
    );
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  if (!sheet || typeof sheet !== "object")
    return NextResponse.json({ error: "Missing sheet" }, { status: 400 });

  const sheetToStore = sanitizeCharacterSheetForStorage(
    migrateCharacterSheet(sheet as CharacterSheet),
  );

  const [conflict] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(
      and(
        eq(characters.userId, session.user.id),
        eq(characters.characterId, characterId)
      )
    )
    .limit(1);

  if (conflict)
    return NextResponse.json(
      { error: "character_id already exists for your account" },
      { status: 409 }
    );

  const id = randomUUID();
  await db.insert(characters).values({
    id,
    characterId,
    userId: session.user.id,
    name,
    sheet: sheetToStore as object,
  });

  return NextResponse.json({ id, characterId }, { status: 201 });
}
