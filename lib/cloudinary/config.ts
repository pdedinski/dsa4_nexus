export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;

  const folder = process.env.CLOUDINARY_FOLDER?.trim() || "DSA";
  return { cloudName, apiKey, apiSecret, folder };
}

export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}
