import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import type { ApSpendingBand } from "@/lib/character/types";
import {
  coerceApBandsFromPayload,
  loadBundledDefaultApProfile,
  DEFAULT_AP_PROFILE_ID,
  sortBandsByFrom,
  type ApiApProfileRow,
} from "@/lib/character/apProfiles";
import { requireAdmin, requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { apSpendingProfiles } from "@/lib/db/schema";

function rowToApi(
  row: typeof apSpendingProfiles.$inferSelect
): Omit<ApiApProfileRow, "isBuiltin"> {
  const bands =
    typeof row.bands === "object" && row.bands !== null && Array.isArray(row.bands)
      ? sortBandsByFrom(row.bands as ApSpendingBand[])
      : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    bands,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const builtin = loadBundledDefaultApProfile();
  const defaultRow: ApiApProfileRow = {
    id: builtin.id,
    name: builtin.name,
    description: builtin.description ?? null,
    bands: sortBandsByFrom(builtin.bands),
    isBuiltin: true,
  };

  const rows =
    session.user.isAdmin || session.user.isSuperuser
      ? await db
          .select()
          .from(apSpendingProfiles)
          .orderBy(desc(apSpendingProfiles.createdAt))
      : [];

  const custom: ApiApProfileRow[] = rows.map(rowToApi);
  const profiles = [defaultRow, ...custom];

  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; description?: string; bands?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const coerce = coerceApBandsFromPayload(body.bands ?? []);
  if (coerce.error || !coerce.bands)
    return NextResponse.json({ error: coerce.error ?? "Invalid bands" }, { status: 400 });

  const [created] = await db
    .insert(apSpendingProfiles)
    .values({
      name,
      description:
        typeof body.description === "string" ? body.description.trim() || null : null,
      bands: coerce.bands,
      createdBy: session.user.id,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: "Could not create profile" }, { status: 500 });
  }

  return NextResponse.json({ profile: rowToApi(created) });
}
