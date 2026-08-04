import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { campaigns } from "@/lib/db/schema";

export async function GET() {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
    })
    .from(campaigns)
    .where(eq(campaigns.userId, session.user.id))
    .orderBy(desc(campaigns.updatedAt));

  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [row] = await db
    .insert(campaigns)
    .values({
      userId: session.user.id,
      name,
      description,
    })
    .returning({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      createdAt: campaigns.createdAt,
      updatedAt: campaigns.updatedAt,
    });

  if (!row)
    return NextResponse.json({ error: "Create failed" }, { status: 500 });

  return NextResponse.json({ campaign: row }, { status: 201 });
}
