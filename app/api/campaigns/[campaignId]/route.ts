import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { campaigns } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

type Ctx = { params: Promise<{ campaignId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await ctx.params;
  const id = decodeURIComponent(campaignId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const [row] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
    })
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ campaign: row });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await ctx.params;
  const id = decodeURIComponent(campaignId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: {
    name?: string;
    description?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name)
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    updates.name = name;
  }
  if (typeof body.description === "string") {
    updates.description = body.description.trim();
  }

  const rows = await db
    .update(campaigns)
    .set(updates)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)))
    .returning({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
    });

  if (!rows.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ campaign: rows[0] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await ctx.params;
  const id = decodeURIComponent(campaignId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const deleted = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)))
    .returning({ id: campaigns.id });

  if (!deleted.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
