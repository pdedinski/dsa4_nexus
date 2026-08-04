import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import {
  assignAssetToCampaign,
  findOwnedCampaign,
  isCampaignAssetType,
  userOwnsAsset,
} from "@/lib/campaigns/assets";
import { db } from "@/lib/db/client";
import { campaignAssets } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Ctx = {
  params: Promise<{ campaignId: string; assetType: string; assetId: string }>;
};

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    campaignId: rawCampaignId,
    assetType: rawType,
    assetId: rawAssetId,
  } = await ctx.params;
  const campaignId = decodeURIComponent(rawCampaignId);
  const assetType = decodeURIComponent(rawType);
  const assetId = decodeURIComponent(rawAssetId);

  if (!UUID_RE.test(campaignId) || !UUID_RE.test(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!isCampaignAssetType(assetType)) {
    return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
  }

  const result = await assignAssetToCampaign({
    campaignId,
    assetType,
    assetId,
    userId: session.user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.reason === "campaign"
            ? "Campaign not found"
            : "Asset not found",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    campaignId: rawCampaignId,
    assetType: rawType,
    assetId: rawAssetId,
  } = await ctx.params;
  const campaignId = decodeURIComponent(rawCampaignId);
  const assetType = decodeURIComponent(rawType);
  const assetId = decodeURIComponent(rawAssetId);

  if (!UUID_RE.test(campaignId) || !UUID_RE.test(assetId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!isCampaignAssetType(assetType)) {
    return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
  }

  const owned = await findOwnedCampaign(campaignId, session.user.id);
  if (!owned)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const owns = await userOwnsAsset(assetType, assetId, session.user.id);
  if (!owns)
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  await db
    .delete(campaignAssets)
    .where(
      and(
        eq(campaignAssets.campaignId, campaignId),
        eq(campaignAssets.assetType, assetType),
        eq(campaignAssets.assetId, assetId)
      )
    );

  return NextResponse.json({ ok: true });
}
