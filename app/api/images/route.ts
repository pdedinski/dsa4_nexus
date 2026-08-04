import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { requireAllowed } from "@/lib/auth/session";
import { assignAssetToCampaign } from "@/lib/campaigns/assets";
import { isCloudinaryConfigured } from "@/lib/cloudinary/config";
import { thumbnailSecureUrl } from "@/lib/cloudinary/thumbnail";
import { uploadImageWithThumbnail } from "@/lib/cloudinary/upload";
import { db } from "@/lib/db/client";
import { campaignAssets, userImages } from "@/lib/db/schema";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = req.nextUrl.searchParams.get("campaignId");
  const cloudinaryConfigured = isCloudinaryConfigured();

  if (campaignId) {
    if (!UUID_RE.test(campaignId)) {
      return NextResponse.json(
        { error: "Invalid campaign id" },
        { status: 400 }
      );
    }
    const rows = await db
      .select({
        id: userImages.id,
        name: userImages.name,
        url: userImages.url,
        publicId: userImages.publicId,
        createdAt: userImages.createdAt,
      })
      .from(userImages)
      .innerJoin(
        campaignAssets,
        and(
          eq(campaignAssets.assetId, userImages.id),
          eq(campaignAssets.assetType, "image"),
          eq(campaignAssets.campaignId, campaignId)
        )
      )
      .where(eq(userImages.userId, session.user.id))
      .orderBy(desc(userImages.createdAt));

    const images = rows.map(({ publicId, ...row }) => ({
      ...row,
      thumbnailUrl: cloudinaryConfigured
        ? thumbnailSecureUrl(publicId)
        : row.url,
    }));

    return NextResponse.json({ images, cloudinaryConfigured });
  }

  const rows = await db
    .select({
      id: userImages.id,
      name: userImages.name,
      url: userImages.url,
      publicId: userImages.publicId,
      createdAt: userImages.createdAt,
    })
    .from(userImages)
    .where(eq(userImages.userId, session.user.id))
    .orderBy(desc(userImages.createdAt));

  const images = rows.map(({ publicId, ...row }) => ({
    ...row,
    thumbnailUrl: cloudinaryConfigured
      ? thumbnailSecureUrl(publicId)
      : row.url,
  }));

  return NextResponse.json({
    images,
    cloudinaryConfigured,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAllowed();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on this server" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const nameRaw = form.get("name");
  const name =
    typeof nameRaw === "string" && nameRaw.trim()
      ? nameRaw.trim()
      : file instanceof File
        ? file.name.replace(/\.[^.]+$/, "") || "Untitled"
        : "";

  if (!name) {
    return NextResponse.json({ error: "Image name is required" }, { status: 400 });
  }

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

  const imageId = randomUUID();
  const publicId = `${session.user.id}/${imageId}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let upload;
  try {
    upload = await uploadImageWithThumbnail(buffer, publicId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Cloudinary upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const [row] = await db
    .insert(userImages)
    .values({
      id: imageId,
      userId: session.user.id,
      name,
      url: upload.secureUrl,
      publicId: upload.publicId,
    })
    .returning({
      id: userImages.id,
      name: userImages.name,
      url: userImages.url,
      createdAt: userImages.createdAt,
    });

  if (!row)
    return NextResponse.json({ error: "Create failed" }, { status: 500 });

  const campaignRaw = form.get("campaignId");
  const campaignId =
    typeof campaignRaw === "string" && campaignRaw.trim()
      ? campaignRaw.trim()
      : null;
  if (campaignId) {
    await assignAssetToCampaign({
      campaignId,
      assetType: "image",
      assetId: row.id,
      userId: session.user.id,
    });
  }

  return NextResponse.json(
    {
      image: {
        ...row,
        thumbnailUrl: upload.thumbnailSecureUrl,
      },
    },
    { status: 201 }
  );
}
