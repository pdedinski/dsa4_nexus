/** Cloudinary public_id segment (under CLOUDINARY_FOLDER) for a saved character portrait. */
export function characterImagePublicId(characterId: string): string {
  return `characters/${characterId}`;
}
