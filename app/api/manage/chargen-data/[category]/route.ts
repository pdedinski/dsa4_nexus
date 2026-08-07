import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ category: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { category } = await ctx.params;
  const table = tableFor(category);
  if (!table) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  try {
    const rows = await db.select().from(table);
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.warn("[chargen-data] list failed", err);
    return NextResponse.json(
      {
        items: [],
        warning: "chargen_data tables unavailable",
      },
      { status: 200 }
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ category: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { category } = await ctx.params;
  const table = tableFor(category);
  if (!table) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  const body = (await req.json()) as {
    entityId?: string;
    data?: Record<string, unknown>;
    notes?: string;
  };
  if (!body.entityId || !body.data) {
    return NextResponse.json(
      { error: "entityId and data are required" },
      { status: 400 }
    );
  }
  try {
    const [row] = await db
      .insert(table)
      .values({
        entityId: body.entityId,
        data: { ...body.data, id: body.entityId, source: "custom" },
        notes: body.notes ?? null,
        createdBy: session.user.id,
      })
      .returning();
    return NextResponse.json({ item: row }, { status: 201 });
  } catch (err) {
    console.error("[chargen-data] create failed", err);
    return NextResponse.json(
      { error: "Failed to create entry (is chargen_data migrated?)" },
      { status: 500 }
    );
  }
}

/** Wipe all custom rows for this category (built-in JSON catalogs are untouched). */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ category: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { category } = await ctx.params;
  const table = tableFor(category);
  if (!table) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  try {
    const rows = await db.delete(table).returning();
    return NextResponse.json({ deleted: rows.length });
  } catch (err) {
    console.error("[chargen-data] delete-all failed", err);
    return NextResponse.json(
      { error: "Failed to delete entries" },
      { status: 500 }
    );
  }
}
