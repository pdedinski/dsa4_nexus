import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenHeroes } from "@/lib/db/chargenSchema";
import { sanitizeHeldForStorage } from "@/lib/chargen/heroesPersistence";
import {
  canViewChargenHero,
  getChargenHeroesSharedVisibility,
} from "@/lib/appSettings";

function canUpdateHero(
  session: { user: { id: string; isAdmin?: boolean; isSuperuser?: boolean } },
  createdBy: string | null
) {
  if (session.user.isAdmin || session.user.isSuperuser) return true;
  return createdBy != null && createdBy === session.user.id;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAllowed();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const [row] = await db
      .select({
        id: chargenHeroes.id,
        characterId: chargenHeroes.characterId,
        version: chargenHeroes.version,
        name: chargenHeroes.name,
        data: chargenHeroes.data,
        createdBy: chargenHeroes.createdBy,
        updatedAt: chargenHeroes.updatedAt,
      })
      .from(chargenHeroes)
      .where(eq(chargenHeroes.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const shared = await getChargenHeroesSharedVisibility();
    if (!canViewChargenHero(session, row.createdBy, shared)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error("[chargen/heroes] get failed", err);
    return NextResponse.json({ error: "Failed to load hero" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAllowed();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

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
    const [existing] = await db
      .select({
        id: chargenHeroes.id,
        createdBy: chargenHeroes.createdBy,
      })
      .from(chargenHeroes)
      .where(eq(chargenHeroes.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!canUpdateHero(session, existing.createdBy)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [row] = await db
      .update(chargenHeroes)
      .set({
        name: sanitized.name,
        data: sanitized.held,
        updatedAt: new Date(),
      })
      .where(eq(chargenHeroes.id, id))
      .returning({
        id: chargenHeroes.id,
        characterId: chargenHeroes.characterId,
        version: chargenHeroes.version,
        name: chargenHeroes.name,
        updatedAt: chargenHeroes.updatedAt,
      });

    return NextResponse.json(row);
  } catch (err) {
    console.error("[chargen/heroes] update failed", err);
    return NextResponse.json(
      { error: "Failed to update hero" },
      { status: 500 }
    );
  }
}
