import { NextRequest, NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { codexEntryVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await requireEditor();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { versionId } = await req.json();
  if (!versionId)
    return NextResponse.json({ error: "Missing versionId" }, { status: 400 });

  // Load the version to get sourceId + entryId
  const [version] = await db
    .select()
    .from(codexEntryVersions)
    .where(eq(codexEntryVersions.id, versionId))
    .limit(1);

  if (!version)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Clear existing defaults for this entry
  await db
    .update(codexEntryVersions)
    .set({ isDefault: false })
    .where(
      and(
        eq(codexEntryVersions.sourceId, version.sourceId),
        eq(codexEntryVersions.entryId, version.entryId),
        eq(codexEntryVersions.isDefault, true)
      )
    );

  // Set the selected version as default
  await db
    .update(codexEntryVersions)
    .set({ isDefault: true })
    .where(eq(codexEntryVersions.id, versionId));

  return NextResponse.json({ ok: true });
}
