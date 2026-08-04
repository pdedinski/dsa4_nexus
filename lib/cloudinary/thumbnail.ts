import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryConfig } from "./config";

/** Longer side capped at this many pixels; aspect ratio preserved via crop "limit". */
export const THUMBNAIL_MAX_LONG_SIDE = 256;

/** Basename of a Cloudinary public_id (last path segment). */
export function publicIdBasename(publicId: string): string {
  const parts = publicId.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? publicId;
}

/**
 * Relative public_id segment for upload (under CLOUDINARY_FOLDER).
 * e.g. DSA/user/uuid or user/uuid → thumbnails/uuid_thumbnail
 */
export function thumbnailPublicIdSegment(originalPublicId: string): string {
  return `thumbnails/${publicIdBasename(originalPublicId)}_thumbnail`;
}

/**
 * Full Cloudinary public_id for the thumbnail asset.
 * Accepts either a relative segment (user/uuid) or a full id (DSA/user/uuid).
 */
export function thumbnailPublicId(originalPublicId: string): string {
  const config = getCloudinaryConfig();
  const folder = config?.folder ?? "DSA";
  return `${folder}/${thumbnailPublicIdSegment(originalPublicId)}`;
}

/**
 * Media Library folder (dynamic folder mode `asset_folder`) for a relative
 * public_id segment under CLOUDINARY_FOLDER.
 * e.g. characters/abc → DSA/characters; thumbnails/x_thumbnail → DSA/thumbnails
 *
 * Does not affect delivery URLs — only Console organization.
 */
export function assetFolderForPublicIdSegment(
  folder: string,
  publicIdSegment: string
): string {
  const relative = publicIdSegment.startsWith(`${folder}/`)
    ? publicIdSegment.slice(folder.length + 1)
    : publicIdSegment;
  const lastSlash = relative.lastIndexOf("/");
  if (lastSlash <= 0) return folder;
  return `${folder}/${relative.slice(0, lastSlash)}`;
}

/** Secure delivery URL for a thumbnail derived from an original public_id. */
export function thumbnailSecureUrl(originalPublicId: string): string {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Cloudinary is not configured");

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  return cloudinary.url(thumbnailPublicId(originalPublicId), {
    secure: true,
    resource_type: "image",
  });
}
