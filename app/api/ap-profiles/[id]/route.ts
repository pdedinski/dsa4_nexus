import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import type { ApSpendingBand } from "@/lib/character/types";
import {
  coerceApBandsFromPayload,
  loadBundledApProfile,
  sortBandsByFrom,
} from "@/lib/character/apProfiles";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { apSpendingProfiles } from "@/lib/db/schema";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id.trim() || loadBundledApProfile(id)) {
    return NextResponse.json(
      { error: "Cannot edit a built-in profile" },
      { status: 400 },
    );
  }

  let body: { name?: string; description?: string; bands?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const coerce = coerceApBandsFromPayload(body.bands ?? []);
  if (coerce.error || !coerce.bands)
    return NextResponse.json({ error: coerce.error ?? "Invalid bands" }, { status: 400 });

  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() || null : undefined;

  const patch: Partial<typeof apSpendingProfiles.$inferInsert> = {
    updatedAt: new Date(),
    ...(name !== undefined ? { name } : {}),
    ...(body.description !== undefined ? { description } : {}),
    bands: coerce.bands,
  };

  const rows = await db
    .update(apSpendingProfiles)
    .set(patch)
    .where(eq(apSpendingProfiles.id, id))
    .returning();

  const [row] = rows;
  if (!row)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const bands =
    typeof row.bands === "object" && row.bands !== null && Array.isArray(row.bands)
      ? sortBandsByFrom(row.bands as ApSpendingBand[])
      : [];

  return NextResponse.json({
    profile: {
      id: row.id,
      name: row.name,
      description: row.description,
      bands,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  if (!id.trim() || loadBundledApProfile(id)) {
    return NextResponse.json(
      { error: "Cannot delete a built-in profile" },
      { status: 400 },
    );
  }

  const rows = await db
    .delete(apSpendingProfiles)
    .where(eq(apSpendingProfiles.id, id))
    .returning({ id: apSpendingProfiles.id });

  if (!rows.length)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
