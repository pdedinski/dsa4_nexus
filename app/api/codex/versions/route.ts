import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { codexEntryVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await requireEditor();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const sourceId = searchParams.get("sourceId");
  const entryId = searchParams.get("entryId");

  if (!sourceId || !entryId)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const versions = await db
    .select()
    .from(codexEntryVersions)
    .where(
      and(
        eq(codexEntryVersions.sourceId, sourceId),
        eq(codexEntryVersions.entryId, entryId)
      )
    )
    .orderBy(codexEntryVersions.createdAt);

  return NextResponse.json({ versions });
}

export async function POST(req: NextRequest) {
  const session = await requireEditor();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { sourceId, entryId, payload, versionLabel, setDefault } = body;

  if (!sourceId || !entryId || !payload)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // If setDefault, clear existing defaults first
  if (setDefault) {
    await db
      .update(codexEntryVersions)
      .set({ isDefault: false })
      .where(
        and(
          eq(codexEntryVersions.sourceId, sourceId),
          eq(codexEntryVersions.entryId, entryId),
          eq(codexEntryVersions.isDefault, true)
        )
      );
  }

  const [inserted] = await db
    .insert(codexEntryVersions)
    .values({
      id: randomUUID(),
      sourceId,
      entryId,
      payload,
      versionLabel: versionLabel ?? null,
      isDefault: !!setDefault,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json({ version: inserted }, { status: 201 });
}

/** Remove one saved version. If it was the default, the newest remaining version becomes default. */
export async function DELETE(req: NextRequest) {
  const session = await requireEditor();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null) as {
    versionId?: string;
  } | null;
  const versionId = body?.versionId;
  if (!versionId)
    return NextResponse.json({ error: "Missing versionId" }, { status: 400 });

  const [row] = await db
    .select()
    .from(codexEntryVersions)
    .where(eq(codexEntryVersions.id, versionId))
    .limit(1);

  if (!row)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { sourceId, entryId, isDefault } = row;

  await db
    .delete(codexEntryVersions)
    .where(eq(codexEntryVersions.id, versionId));

  if (isDefault) {
    const [nextDefault] = await db
      .select()
      .from(codexEntryVersions)
      .where(
        and(
          eq(codexEntryVersions.sourceId, sourceId),
          eq(codexEntryVersions.entryId, entryId)
        )
      )
      .orderBy(desc(codexEntryVersions.createdAt))
      .limit(1);

    if (nextDefault) {
      await db
        .update(codexEntryVersions)
        .set({ isDefault: true })
        .where(eq(codexEntryVersions.id, nextDefault.id));
    }
  }

  return NextResponse.json({ ok: true });
}
