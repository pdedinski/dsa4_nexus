import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  campaignAssets,
  campaigns,
  characters,
  notes,
  userImages,
  type CampaignAssetType,
} from "@/lib/db/schema";

const ASSET_TYPES = new Set<CampaignAssetType>(["character", "note", "image"]);

export function isCampaignAssetType(s: string): s is CampaignAssetType {
  return ASSET_TYPES.has(s as CampaignAssetType);
}

/** Returns the campaign id if it belongs to the user, else null. */
export async function findOwnedCampaign(
  campaignId: string,
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)))
    .limit(1);
  return row?.id ?? null;
}

/** True if the asset UUID belongs to the user for the given type. */
export async function userOwnsAsset(
  assetType: CampaignAssetType,
  assetId: string,
  userId: string
): Promise<boolean> {
  if (assetType === "character") {
    const [row] = await db
      .select({ id: characters.id })
      .from(characters)
      .where(and(eq(characters.id, assetId), eq(characters.userId, userId)))
      .limit(1);
    return Boolean(row);
  }
  if (assetType === "note") {
    const [row] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, assetId), eq(notes.userId, userId)))
      .limit(1);
    return Boolean(row);
  }
  const [row] = await db
    .select({ id: userImages.id })
    .from(userImages)
    .where(and(eq(userImages.id, assetId), eq(userImages.userId, userId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Assign an owned asset to an owned campaign. Idempotent (ignores unique conflict).
 * Returns false if campaign or asset is not owned by the user.
 */
export async function assignAssetToCampaign(opts: {
  campaignId: string;
  assetType: CampaignAssetType;
  assetId: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; reason: "campaign" | "asset" }> {
  const ownedCampaign = await findOwnedCampaign(opts.campaignId, opts.userId);
  if (!ownedCampaign) return { ok: false, reason: "campaign" };
  const owns = await userOwnsAsset(opts.assetType, opts.assetId, opts.userId);
  if (!owns) return { ok: false, reason: "asset" };

  await db
    .insert(campaignAssets)
    .values({
      campaignId: opts.campaignId,
      assetType: opts.assetType,
      assetId: opts.assetId,
    })
    .onConflictDoNothing();

  return { ok: true };
}

/** Remove all campaign links for a deleted asset (no FK cascade on asset_id). */
export async function removeAssetFromAllCampaigns(
  assetType: CampaignAssetType,
  assetId: string
): Promise<void> {
  await db
    .delete(campaignAssets)
    .where(
      and(
        eq(campaignAssets.assetType, assetType),
        eq(campaignAssets.assetId, assetId)
      )
    );
}
