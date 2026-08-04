import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { findOwnedCampaign } from "@/lib/campaigns/assets";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { thumbnailSecureUrl } from "@/lib/cloudinary/thumbnail";
import { db } from "@/lib/db/client";
import {
  campaignAssets,
  characters,
  notes,
  userImages,
} from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Ctx = { params: Promise<{ campaignId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await ctx.params;
  const id = decodeURIComponent(campaignId);
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const owned = await findOwnedCampaign(id, session.user.id);
  if (!owned)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = session.user.id;

  const characterRows = await db
    .select({
      id: characters.id,
      characterId: characters.characterId,
      name: characters.name,
      assigned: sql<boolean>`${campaignAssets.campaignId} IS NOT NULL`,
    })
    .from(characters)
    .leftJoin(
      campaignAssets,
      and(
        eq(campaignAssets.assetId, characters.id),
        eq(campaignAssets.assetType, "character"),
        eq(campaignAssets.campaignId, id)
      )
    )
    .where(eq(characters.userId, userId))
    .orderBy(asc(characters.name));

  const noteRows = await db
    .select({
      id: notes.id,
      title: notes.title,
      assigned: sql<boolean>`${campaignAssets.campaignId} IS NOT NULL`,
    })
    .from(notes)
    .leftJoin(
      campaignAssets,
      and(
        eq(campaignAssets.assetId, notes.id),
        eq(campaignAssets.assetType, "note"),
        eq(campaignAssets.campaignId, id)
      )
    )
    .where(eq(notes.userId, userId))
    .orderBy(asc(notes.title));

  const imageRows = await db
    .select({
      id: userImages.id,
      name: userImages.name,
      url: userImages.url,
      publicId: userImages.publicId,
      assigned: sql<boolean>`${campaignAssets.campaignId} IS NOT NULL`,
    })
    .from(userImages)
    .leftJoin(
      campaignAssets,
      and(
        eq(campaignAssets.assetId, userImages.id),
        eq(campaignAssets.assetType, "image"),
        eq(campaignAssets.campaignId, id)
      )
    )
    .where(eq(userImages.userId, userId))
    .orderBy(asc(userImages.name));

  const cloudinaryConfigured = isCloudinaryConfigured();

  return NextResponse.json({
    characters: characterRows.map((r) => ({
      id: r.id,
      characterId: r.characterId,
      name: r.name,
      assigned: Boolean(r.assigned),
    })),
    notes: noteRows.map((r) => ({
      id: r.id,
      title: r.title,
      assigned: Boolean(r.assigned),
    })),
    images: imageRows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      thumbnailUrl: cloudinaryConfigured
        ? thumbnailSecureUrl(r.publicId)
        : r.url,
      assigned: Boolean(r.assigned),
    })),
  });
}
