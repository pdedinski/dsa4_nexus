import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq, ilike, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const rows = q
    ? await db
        .select()
        .from(users)
        .where(
          or(
            ilike(users.email, `%${q}%`),
            ilike(users.displayName, `%${q}%`)
          )
        )
        .orderBy(users.lastLoginAt)
    : await db.select().from(users).orderBy(users.lastLoginAt);

  // Never expose googleSub in API response
  const safe = rows.map(({ googleSub: _gs, ...rest }) => rest);
  return NextResponse.json({ users: safe });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const actor = session.user;
  const body = await req.json();
  const { userId, isAllowed, isEditor, isAdmin: newIsAdmin } = body;

  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  // Block self-edit
  if (userId === actor.id)
    return NextResponse.json(
      { error: "Cannot edit your own account." },
      { status: 403 }
    );

  // Load target
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Non-superuser admins cannot edit superusers or other admins
  if (!actor.isSuperuser) {
    if (target.isSuperuser)
      return NextResponse.json(
        { error: "Cannot edit a superuser." },
        { status: 403 }
      );
    if (target.isAdmin)
      return NextResponse.json(
        { error: "Cannot edit another admin." },
        { status: 403 }
      );
  }

  await db
    .update(users)
    .set({
      isAllowed: isAllowed ?? target.isAllowed,
      isEditor: isEditor ?? target.isEditor,
      isAdmin: newIsAdmin ?? target.isAdmin,
    })
    .where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const actor = session.user;
  const { userId } = await req.json();

  if (!userId)
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  if (userId === actor.id)
    return NextResponse.json(
      { error: "Cannot delete your own account." },
      { status: 403 }
    );

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!target)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!actor.isSuperuser) {
    if (target.isSuperuser)
      return NextResponse.json(
        { error: "Cannot delete a superuser." },
        { status: 403 }
      );
    if (target.isAdmin)
      return NextResponse.json(
        { error: "Cannot delete another admin." },
        { status: 403 }
      );
  }

  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}
