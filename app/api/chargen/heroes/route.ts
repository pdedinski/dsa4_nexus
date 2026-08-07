import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenHeroes } from "@/lib/db/chargenSchema";
import { users } from "@/lib/db/schema";
import { sanitizeHeldForStorage } from "@/lib/chargen/heroesPersistence";

export async function GET() {
  const session = await requireAllowed();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: chargenHeroes.id,
        name: chargenHeroes.name,
        updatedAt: chargenHeroes.updatedAt,
        createdBy: chargenHeroes.createdBy,
        ownerName: users.displayName,
      })
      .from(chargenHeroes)
      .leftJoin(users, eq(chargenHeroes.createdBy, users.id))
      .orderBy(asc(chargenHeroes.name));

    return NextResponse.json({
      heroes: rows.map((r) => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy,
        ownerName: r.ownerName ?? null,
      })),
    });
  } catch (err) {
    console.warn("[chargen/heroes] list failed", err);
    return NextResponse.json(
      { heroes: [], warning: "chargen_data.heroes unavailable" },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sanitized = sanitizeHeldForStorage(body.data);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(chargenHeroes)
      .values({
        name: sanitized.name,
        data: sanitized.held,
        createdBy: session.user.id,
      })
      .returning({
        id: chargenHeroes.id,
        name: chargenHeroes.name,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[chargen/heroes] create failed", err);
    return NextResponse.json(
      { error: "Failed to persist hero (is chargen_data.heroes migrated?)" },
      { status: 500 }
    );
  }
}
