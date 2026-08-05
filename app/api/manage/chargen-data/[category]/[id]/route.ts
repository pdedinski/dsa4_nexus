import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { chargenCatalogTables } from "@/lib/db/chargenSchema";
import {
  CHARGEN_CATALOG_CATEGORIES,
  type ChargenCatalogCategory,
} from "@/lib/chargen/types";

function tableFor(category: string) {
  if (!CHARGEN_CATALOG_CATEGORIES.includes(category as ChargenCatalogCategory)) {
    return null;
  }
  return chargenCatalogTables[category as ChargenCatalogCategory];
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ category: string; id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { category, id } = await ctx.params;
  const table = tableFor(category);
  if (!table) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  const body = (await req.json()) as {
    entityId?: string;
    data?: Record<string, unknown>;
    notes?: string | null;
  };
  try {
    const [row] = await db
      .update(table)
      .set({
        ...(body.entityId ? { entityId: body.entityId } : {}),
        ...(body.data
          ? {
              data: {
                ...body.data,
                id: body.entityId || body.data.id,
                source: "custom",
              },
            }
          : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(table.id, id))
      .returning();
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ item: row });
  } catch (err) {
    console.error("[chargen-data] update failed", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ category: string; id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { category, id } = await ctx.params;
  const table = tableFor(category);
  if (!table) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  try {
    const [row] = await db
      .delete(table)
      .where(eq(table.id, id))
      .returning();
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chargen-data] delete failed", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
