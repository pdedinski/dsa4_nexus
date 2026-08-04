import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { removeAssetFromAllCampaigns } from "@/lib/campaigns/assets";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { destroyImageWithThumbnail } from "@/lib/cloudinary/destroy";
import { db } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";
import type { CharacterSheet } from "@/lib/character/types";
import { migrateCharacterSheet } from "@/lib/character/sheetMigration";
import { sanitizeCharacterSheetForStorage } from "@/lib/character/sheetPersistence";

type Ctx = { params: Promise<{ characterId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = await ctx.params;
  const cid = decodeURIComponent(characterId).toLowerCase();

  const [row] = await db
    .select()
    .from(characters)
    .where(
      and(eq(characters.userId, session.user.id), eq(characters.characterId, cid))
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sheet = migrateCharacterSheet(row.sheet as CharacterSheet);

  return NextResponse.json({
    id: row.id,
    characterId: row.characterId,
    name: row.name,
    sheet,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    cloudinaryConfigured: isCloudinaryConfigured(),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = await ctx.params;
  const cid = decodeURIComponent(characterId).toLowerCase();

  let body: { name?: string; sheet?: CharacterSheet };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { name?: string; sheet?: object; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (body.sheet && typeof body.sheet === "object")
    updates.sheet = sanitizeCharacterSheetForStorage(
      migrateCharacterSheet(body.sheet as CharacterSheet),
    ) as object;

  const rows = await db
    .update(characters)
    .set(updates)
    .where(
      and(eq(characters.userId, session.user.id), eq(characters.characterId, cid))
    )
    .returning();

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = await ctx.params;
  const cid = decodeURIComponent(characterId).toLowerCase();

  const [row] = await db
    .select()
    .from(characters)
    .where(
      and(eq(characters.userId, session.user.id), eq(characters.characterId, cid))
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.imagePublicId) {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        {
          error:
            "Cloudinary is not configured; cannot delete character image from cloud storage",
        },
        { status: 503 }
      );
    }
    try {
      await destroyImageWithThumbnail(row.imagePublicId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Cloudinary delete failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  await removeAssetFromAllCampaigns("character", row.id);
  await db.delete(characters).where(eq(characters.id, row.id));

  return NextResponse.json({ ok: true });
}
