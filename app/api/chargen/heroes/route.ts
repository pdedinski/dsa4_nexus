import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenHeroes } from "@/lib/db/chargenSchema";
import { users } from "@/lib/db/schema";
import { sanitizeHeldForStorage } from "@/lib/chargen/heroesPersistence";
import { groupHeroesByCharacter } from "@/lib/chargen/heroesVersioning";
import {
  canViewChargenHero,
  getChargenHeroesSharedVisibility,
  isAdminOrSuperuser,
} from "@/lib/appSettings";
import { randomUUID } from "crypto";

function canUpdateHero(
  session: { user: { id: string; isAdmin?: boolean; isSuperuser?: boolean } },
  createdBy: string | null
) {
  if (session.user.isAdmin || session.user.isSuperuser) return true;
  return createdBy != null && createdBy === session.user.id;
}

export async function GET() {
  const session = await requireAllowed();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const shared = await getChargenHeroesSharedVisibility();
    const restrictToOwn = !shared && !isAdminOrSuperuser(session);

    const base = db
      .select({
        id: chargenHeroes.id,
        characterId: chargenHeroes.characterId,
        version: chargenHeroes.version,
        name: chargenHeroes.name,
        updatedAt: chargenHeroes.updatedAt,
        createdBy: chargenHeroes.createdBy,
        ownerName: users.displayName,
      })
      .from(chargenHeroes)
      .leftJoin(users, eq(chargenHeroes.createdBy, users.id));

    const rows = restrictToOwn
      ? await base
          .where(eq(chargenHeroes.createdBy, session.user.id))
          .orderBy(asc(chargenHeroes.name), asc(chargenHeroes.version))
      : await base.orderBy(asc(chargenHeroes.name), asc(chargenHeroes.version));

    const visible = rows.filter((r) =>
      canViewChargenHero(session, r.createdBy, shared)
    );

    const heroes = groupHeroesByCharacter(
      visible.map((r) => ({
        id: r.id,
        characterId: r.characterId,
        version: r.version,
        name: r.name,
        updatedAt: r.updatedAt,
        createdBy: r.createdBy,
        ownerName: r.ownerName ?? null,
      }))
    );

    return NextResponse.json({ heroes });
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

  let body: { data?: unknown; characterId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sanitized = sanitizeHeldForStorage(body.data);
  if (!sanitized.ok) {
    return NextResponse.json({ error: sanitized.error }, { status: 400 });
  }

  const characterIdRaw =
    typeof body.characterId === "string" ? body.characterId.trim() : "";

  try {
    if (characterIdRaw) {
      const siblings = await db
        .select({
          id: chargenHeroes.id,
          createdBy: chargenHeroes.createdBy,
          version: chargenHeroes.version,
        })
        .from(chargenHeroes)
        .where(eq(chargenHeroes.characterId, characterIdRaw))
        .orderBy(desc(chargenHeroes.version));

      if (siblings.length === 0) {
        return NextResponse.json(
          { error: "Character not found" },
          { status: 404 }
        );
      }

      const anchor = siblings[0]!;
      if (!canUpdateHero(session, anchor.createdBy)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const nextVersion = Math.max(...siblings.map((s) => s.version)) + 1;

      const [row] = await db
        .insert(chargenHeroes)
        .values({
          characterId: characterIdRaw,
          version: nextVersion,
          name: sanitized.name,
          data: sanitized.held,
          createdBy: anchor.createdBy ?? session.user.id,
        })
        .returning({
          id: chargenHeroes.id,
          characterId: chargenHeroes.characterId,
          version: chargenHeroes.version,
          name: chargenHeroes.name,
          updatedAt: chargenHeroes.updatedAt,
        });

      return NextResponse.json(row, { status: 201 });
    }

    const characterId = randomUUID();
    const [row] = await db
      .insert(chargenHeroes)
      .values({
        characterId,
        version: 1,
        name: sanitized.name,
        data: sanitized.held,
        createdBy: session.user.id,
      })
      .returning({
        id: chargenHeroes.id,
        characterId: chargenHeroes.characterId,
        version: chargenHeroes.version,
        name: chargenHeroes.name,
        updatedAt: chargenHeroes.updatedAt,
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
