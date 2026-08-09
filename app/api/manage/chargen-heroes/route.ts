import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenHeroes } from "@/lib/db/chargenSchema";
import { users } from "@/lib/db/schema";
import { groupHeroesByCharacter } from "@/lib/chargen/heroesVersioning";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        id: chargenHeroes.id,
        characterId: chargenHeroes.characterId,
        version: chargenHeroes.version,
        name: chargenHeroes.name,
        updatedAt: chargenHeroes.updatedAt,
        createdAt: chargenHeroes.createdAt,
        createdBy: chargenHeroes.createdBy,
        ownerName: users.displayName,
      })
      .from(chargenHeroes)
      .leftJoin(users, eq(chargenHeroes.createdBy, users.id))
      .orderBy(asc(chargenHeroes.name), asc(chargenHeroes.version));

    const heroes = groupHeroesByCharacter(
      rows.map((r) => ({
        id: r.id,
        characterId: r.characterId,
        version: r.version,
        name: r.name,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        ownerName: r.ownerName ?? null,
      }))
    );

    return NextResponse.json({ heroes });
  } catch (err) {
    console.warn("[manage/chargen-heroes] list failed", err);
    return NextResponse.json(
      { heroes: [], warning: "chargen_data.heroes unavailable" },
      { status: 200 }
    );
  }
}
