import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

type Ctx = { params: Promise<{ noteId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await ctx.params;
  const id = decodeURIComponent(noteId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });

  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, session.user.id), eq(notes.id, id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await ctx.params;
  const id = decodeURIComponent(noteId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });

  let body: { title?: string; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: { title?: string; content?: object; updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (typeof body.title === "string") updates.title = body.title;
  if (
    body.content !== undefined &&
    typeof body.content === "object" &&
    body.content !== null &&
    !Array.isArray(body.content)
  ) {
    updates.content = body.content as object;
  }

  const rows = await db
    .update(notes)
    .set(updates)
    .where(and(eq(notes.userId, session.user.id), eq(notes.id, id)))
    .returning();

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { noteId } = await ctx.params;
  const id = decodeURIComponent(noteId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });

  const deleted = await db
    .delete(notes)
    .where(and(eq(notes.userId, session.user.id), eq(notes.id, id)))
    .returning({ id: notes.id });

  if (!deleted.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
