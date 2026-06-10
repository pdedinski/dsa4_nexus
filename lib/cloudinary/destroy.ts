import { v2 as cloudinary } from "cloudinary";
import { getCloudinaryConfig } from "./config";

export async function destroyImage(publicId: string): Promise<void> {
  const config = getCloudinaryConfig();
  if (!config) throw new Error("Cloudinary is not configured");

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(`Cloudinary destroy failed: ${result.result}`);
  }
}
