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

type BulkItem = { entityId?: string; data?: Record<string, unknown> };

/** Bulk upsert (insert-or-update by entity_id) — used by catalog XML import. */
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
  const body = (await req.json().catch(() => null)) as {
    items?: BulkItem[];
  } | null;
  const items = body?.items ?? [];
  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: "items[] is required" }, { status: 400 });
  }

  let imported = 0;
  const errors: string[] = [];
  for (const item of items) {
    const entityId = item.entityId?.trim();
    if (!entityId || !item.data) {
      errors.push(`Skipped entry missing entityId/data: ${JSON.stringify(item).slice(0, 80)}`);
      continue;
    }
    try {
      const data = { ...item.data, id: entityId, source: "custom" as const };
      await db
        .insert(table)
        .values({
          entityId,
          data,
          createdBy: session.user.id,
        })
        .onConflictDoUpdate({
          target: table.entityId,
          set: { data, updatedAt: new Date() },
        });
      imported++;
    } catch (err) {
      errors.push(
        `${entityId}: ${err instanceof Error ? err.message : "insert failed"}`
      );
    }
  }

  return NextResponse.json({ imported, total: items.length, errors });
}
