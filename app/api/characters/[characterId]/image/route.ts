import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { characterImagePublicId } from "@/lib/cloudinary/characterImage";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { destroyImage } from "@/lib/cloudinary/destroy";
import { uploadImageBuffer } from "@/lib/cloudinary/upload";
import { db } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type Ctx = { params: Promise<{ characterId: string }> };

async function loadOwnedCharacter(userId: string, characterId: string) {
  const cid = decodeURIComponent(characterId).toLowerCase();
  const [row] = await db
    .select()
    .from(characters)
    .where(and(eq(characters.userId, userId), eq(characters.characterId, cid)))
    .limit(1);
  return row ?? null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on this server" },
      { status: 503 }
    );
  }

  const { characterId } = await ctx.params;
  const row = await loadOwnedCharacter(session.user.id, characterId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 10 MB)" },
      { status: 400 }
    );
  }

  const publicId = characterImagePublicId(row.characterId);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (row.imagePublicId && row.imagePublicId !== publicId) {
    try {
      await destroyImage(row.imagePublicId);
    } catch {
      // Best effort; new upload uses canonical public id.
    }
  }

  let upload;
  try {
    upload = await uploadImageBuffer(buffer, publicId, { overwrite: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Cloudinary upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const [updated] = await db
    .update(characters)
    .set({
      imageUrl: upload.secureUrl,
      imagePublicId: upload.publicId,
      updatedAt: new Date(),
    })
    .where(eq(characters.id, row.id))
    .returning({
      imageUrl: characters.imageUrl,
      imagePublicId: characters.imagePublicId,
    });

  if (!updated)
    return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({
    imageUrl: updated.imageUrl,
    imagePublicId: updated.imagePublicId,
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = await ctx.params;
  const row = await loadOwnedCharacter(session.user.id, characterId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!row.imagePublicId) {
    return NextResponse.json({ error: "No image set" }, { status: 404 });
  }

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured; cannot delete from cloud storage" },
      { status: 503 }
    );
  }

  try {
    await destroyImage(row.imagePublicId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Cloudinary delete failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  await db
    .update(characters)
    .set({
      imageUrl: null,
      imagePublicId: null,
      updatedAt: new Date(),
    })
    .where(eq(characters.id, row.id));

  return NextResponse.json({ ok: true });
}
