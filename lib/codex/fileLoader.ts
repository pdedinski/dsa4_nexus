import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");

export interface FileData {
  meta: Record<string, unknown>;
  items: Record<string, unknown>[];
  /** For combat_maneuvers, which has multiple arrays, or advancement_costs */
  raw: Record<string, unknown>;
}

/** combat_maneuvers has four named sub-arrays rather than one flat list */
const MULTI_ARRAY_FILES: Record<string, string[]> = {
  combat_maneuvers: [
    "attack_actions",
    "defense_actions",
    "free_actions",
    "special_situations",
  ],
};

/** advancement_costs has no flat item array; expose raw only */
const RAW_ONLY_FILES = new Set(["advancement_costs"]);

export function loadFileData(category: string, fileKey: string): FileData {
  const filePath = path.join(dataDir, category, `${fileKey}.json`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
    string,
    unknown
  >;
  const meta = (raw.meta ?? {}) as Record<string, unknown>;

  if (RAW_ONLY_FILES.has(fileKey)) {
    return { meta, items: [], raw };
  }

  if (MULTI_ARRAY_FILES[fileKey]) {
    const items: Record<string, unknown>[] = [];
    for (const key of MULTI_ARRAY_FILES[fileKey]) {
      const arr = raw[key];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          items.push({ ...item, _subArray: key });
        }
      }
    }
    return { meta, items, raw };
  }

  // Standard: find the first top-level array
  for (const [key, value] of Object.entries(raw)) {
    if (key !== "meta" && Array.isArray(value)) {
      return { meta, items: value as Record<string, unknown>[], raw };
    }
  }

  return { meta, items: [], raw };
}

export function fileExists(category: string, fileKey: string): boolean {
  return fs.existsSync(
    path.join(dataDir, category, `${fileKey}.json`)
  );
}
