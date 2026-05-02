import rawManifest from "@/data/manifest.json";

export interface ManifestEntry {
  category: string;
  fileKey: string;
  arrayKey: string;
  label: string;
}

export const manifest: ManifestEntry[] = rawManifest;

export function categories(): string[] {
  return [...new Set(manifest.map((m) => m.category))];
}

export function entriesForCategory(category: string): ManifestEntry[] {
  return manifest.filter((m) => m.category === category);
}

export function findEntry(
  category: string,
  fileKey: string
): ManifestEntry | undefined {
  return manifest.find(
    (m) => m.category === category && m.fileKey === fileKey
  );
}
