import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { notes } from "@/lib/db/schema";
import { emptyNoteDoc } from "@/lib/notes/emptyNoteDoc";

export async function GET() {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: notes.id,
      title: notes.title,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    })
    .from(notes)
    .where(eq(notes.userId, session.user.id))
    .orderBy(desc(notes.updatedAt));

  return NextResponse.json({ notes: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; content?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const title = typeof body.title === "string" ? body.title : "";
  const content =
    body.content && typeof body.content === "object" && !Array.isArray(body.content)
      ? (body.content as object)
      : emptyNoteDoc();

  const [row] = await db
    .insert(notes)
    .values({
      userId: session.user.id,
      title,
      content,
    })
    .returning({
      id: notes.id,
      title: notes.title,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
    });

  if (!row)
    return NextResponse.json({ error: "Create failed" }, { status: 500 });

  return NextResponse.json({ note: row }, { status: 201 });
}
