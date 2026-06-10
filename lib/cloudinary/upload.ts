import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryConfig } from "./config";

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
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
  publicId: string
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
        resource_type: "image",
        overwrite: false,
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
