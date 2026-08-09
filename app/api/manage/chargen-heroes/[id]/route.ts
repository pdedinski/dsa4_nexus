import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenHeroes } from "@/lib/db/chargenSchema";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const allVersions =
    req.nextUrl.searchParams.get("allVersions") === "1" ||
    req.nextUrl.searchParams.get("allVersions") === "true";

  try {
    const [existing] = await db
      .select({
        id: chargenHeroes.id,
        characterId: chargenHeroes.characterId,
      })
      .from(chargenHeroes)
      .where(eq(chargenHeroes.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (allVersions) {
      const deleted = await db
        .delete(chargenHeroes)
        .where(eq(chargenHeroes.characterId, existing.characterId))
        .returning({ id: chargenHeroes.id });
      return NextResponse.json({
        ok: true,
        deletedCount: deleted.length,
        characterId: existing.characterId,
      });
    }

    await db.delete(chargenHeroes).where(eq(chargenHeroes.id, id));
    return NextResponse.json({ ok: true, deletedCount: 1 });
  } catch (err) {
    console.error("[manage/chargen-heroes] delete failed", err);
    return NextResponse.json(
      { error: "Failed to delete hero" },
      { status: 500 }
    );
  }
}
