import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { findOwnedCampaign } from "@/lib/campaigns/assets";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { campaignId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.campaignId;
  if (raw !== null && raw !== undefined && typeof raw !== "string") {
    return NextResponse.json(
      { error: "campaignId must be a string or null" },
      { status: 400 }
    );
  }

  const campaignId =
    raw === null || raw === undefined || raw === ""
      ? null
      : raw.trim();

  if (campaignId !== null) {
    if (!UUID_RE.test(campaignId)) {
      return NextResponse.json(
        { error: "Invalid campaign id" },
        { status: 400 }
      );
    }
    const owned = await findOwnedCampaign(campaignId, session.user.id);
    if (!owned) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }
  }

  await db
    .update(users)
    .set({ selectedCampaignId: campaignId })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ selectedCampaignId: campaignId });
}
