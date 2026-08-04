import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { assignAssetToCampaign } from "@/lib/campaigns/assets";
import { db } from "@/lib/db/client";
import { campaignAssets, notes } from "@/lib/db/schema";
import { emptyNoteDoc } from "@/lib/notes/emptyNoteDoc";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get("campaignId");

  if (campaignId) {
    if (!UUID_RE.test(campaignId)) {
      return NextResponse.json(
        { error: "Invalid campaign id" },
        { status: 400 }
      );
    }
    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .innerJoin(
        campaignAssets,
        and(
          eq(campaignAssets.assetId, notes.id),
          eq(campaignAssets.assetType, "note"),
          eq(campaignAssets.campaignId, campaignId)
        )
      )
      .where(eq(notes.userId, session.user.id))
      .orderBy(desc(notes.updatedAt));
    return NextResponse.json({ notes: rows });
  }

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(eq(notes.userId, session.user.id))
    .orderBy(desc(notes.updatedAt));

  return NextResponse.json({ notes: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; content?: unknown; campaignId?: string | null };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const title = typeof body.title === "string" ? body.title : "";
  const content =
    body.content && typeof body.content === "object" && !Array.isArray(body.content)
      ? (body.content as object)
      : emptyNoteDoc();

  const [row] = await db
    .insert(notes)
    .values({
      userId: session.user.id,
      title,
      content,
    })
    .returning({
      id: notes.id,
      title: notes.title,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    });

  if (!row)
    return NextResponse.json({ error: "Create failed" }, { status: 500 });

  const campaignId =
    typeof body.campaignId === "string" && body.campaignId.trim()
      ? body.campaignId.trim()
      : null;
  if (campaignId) {
    await assignAssetToCampaign({
      campaignId,
      assetType: "note",
      assetId: row.id,
      userId: session.user.id,
    });
  }

  return NextResponse.json({ note: row }, { status: 201 });
}
