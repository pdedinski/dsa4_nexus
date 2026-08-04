import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryConfig } from "./config";
import { destroyImage } from "./destroy";
import {
  THUMBNAIL_MAX_LONG_SIDE,
  assetFolderForPublicIdSegment,
  thumbnailPublicIdSegment,
} from "./thumbnail";

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

export type CloudinaryUploadWithThumbnailResult = CloudinaryUploadResult & {
  thumbnailPublicId: string;
  thumbnailSecureUrl: string;
};

function configureCloudinary() {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Cloudinary is not configured");
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  return config;
}

export async function uploadImageBuffer(
  buffer: Buffer,
  publicId: string,
  options?: { overwrite?: boolean }
): Promise<CloudinaryUploadResult> {
  const config = configureCloudinary();

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: config.folder,
        public_id: publicId,
        // Dynamic folder mode: Media Library path is independent of public_id.
        asset_folder: assetFolderForPublicIdSegment(config.folder, publicId),
        resource_type: "image",
        overwrite: options?.overwrite ?? false,
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error("Upload failed"));
        else resolve(res);
      }
    );
    stream.end(buffer);
  });

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
  };
}

async function uploadThumbnailBuffer(
  buffer: Buffer,
  originalPublicId: string,
  options?: { overwrite?: boolean }
): Promise<CloudinaryUploadResult> {
  const config = configureCloudinary();
  const thumbSegment = thumbnailPublicIdSegment(originalPublicId);

  const result = await new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: config.folder,
        public_id: thumbSegment,
        asset_folder: assetFolderForPublicIdSegment(
          config.folder,
          thumbSegment
        ),
        resource_type: "image",
        overwrite: options?.overwrite ?? false,
        transformation: [
          {
            width: THUMBNAIL_MAX_LONG_SIDE,
            height: THUMBNAIL_MAX_LONG_SIDE,
            crop: "limit",
            quality: "auto",
          },
        ],
      },
      (err, res) => {
        if (err || !res) reject(err ?? new Error("Thumbnail upload failed"));
        else resolve(res);
      }
    );
    stream.end(buffer);
  });

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
  };
}

export async function uploadImageWithThumbnail(
  buffer: Buffer,
  publicId: string,
  options?: { overwrite?: boolean }
): Promise<CloudinaryUploadWithThumbnailResult> {
  const original = await uploadImageBuffer(buffer, publicId, options);

  try {
    const thumbnail = await uploadThumbnailBuffer(
      buffer,
      original.publicId,
      options
    );
    return {
      ...original,
      thumbnailPublicId: thumbnail.publicId,
      thumbnailSecureUrl: thumbnail.secureUrl,
    };
  } catch (err) {
    try {
      await destroyImage(original.publicId);
    } catch {
      // Best effort rollback of the original after thumbnail failure.
    }
    throw err;
  }
}
