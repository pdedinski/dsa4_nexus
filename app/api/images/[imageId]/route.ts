import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { destroyImage } from "@/lib/cloudinary/destroy";
import { db } from "@/lib/db/client";
import { userImages } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

type Ctx = { params: Promise<{ imageId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageId } = await ctx.params;
  const id = decodeURIComponent(imageId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid image id" }, { status: 400 });

  const [row] = await db
    .select({
      id: userImages.id,
      name: userImages.name,
      url: userImages.url,
      createdAt: userImages.createdAt,
    })
    .from(userImages)
    .where(and(eq(userImages.userId, session.user.id), eq(userImages.id, id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ image: row });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageId } = await ctx.params;
  const id = decodeURIComponent(imageId);
  if (!isUuid(id))
    return NextResponse.json({ error: "Invalid image id" }, { status: 400 });

  const deleteFromCloud =
    req.nextUrl.searchParams.get("deleteFromCloud") === "true";

  const [row] = await db
    .select()
    .from(userImages)
    .where(and(eq(userImages.userId, session.user.id), eq(userImages.id, id)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (deleteFromCloud) {
    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "Cloudinary is not configured; cannot delete from cloud storage" },
        { status: 503 }
      );
    }
    try {
      await destroyImage(row.publicId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Cloudinary delete failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  const deleted = await db
    .delete(userImages)
    .where(and(eq(userImages.userId, session.user.id), eq(userImages.id, id)))
    .returning({ id: userImages.id });

  if (!deleted.length)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
