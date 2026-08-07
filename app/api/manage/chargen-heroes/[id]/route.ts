import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenHeroes } from "@/lib/db/chargenSchema";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  try {
    const deleted = await db
      .delete(chargenHeroes)
      .where(eq(chargenHeroes.id, id))
      .returning({ id: chargenHeroes.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[manage/chargen-heroes] delete failed", err);
    return NextResponse.json(
      { error: "Failed to delete hero" },
      { status: 500 }
    );
  }
}
