/**
 * Group version rows into one character entry (latest version on top).
 */

export type HeroVersionRow = {
  id: string;
  characterId: string;
  version: number;
  name: string;
  updatedAt: Date | string;
  createdAt?: Date | string;
  createdBy: string | null;
  ownerName?: string | null;
};

export type GroupedChargenCharacter = {
  characterId: string;
  id: string;
  name: string;
  version: number;
  updatedAt: Date | string;
  createdAt?: Date | string;
  createdBy: string | null;
  ownerName: string | null;
  versions: Array<{
    id: string;
    version: number;
    name: string;
    updatedAt: Date | string;
    createdAt?: Date | string;
    createdBy: string | null;
    ownerName: string | null;
  }>;
};

function toTime(v: Date | string | undefined): number {
  if (!v) return 0;
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}

/** Group flat version rows by characterId; primary fields come from the highest version. */
export function groupHeroesByCharacter(
  rows: HeroVersionRow[]
): GroupedChargenCharacter[] {
  const byCharacter = new Map<string, HeroVersionRow[]>();
  for (const row of rows) {
    const list = byCharacter.get(row.characterId) ?? [];
    list.push(row);
    byCharacter.set(row.characterId, list);
  }

  const grouped: GroupedChargenCharacter[] = [];
  for (const [characterId, versions] of byCharacter) {
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const latest = sorted[sorted.length - 1]!;
    grouped.push({
      characterId,
      id: latest.id,
      name: latest.name,
      version: latest.version,
      updatedAt: latest.updatedAt,
      createdAt: latest.createdAt,
      createdBy: latest.createdBy,
      ownerName: latest.ownerName ?? null,
      versions: sorted.map((v) => ({
        id: v.id,
        version: v.version,
        name: v.name,
        updatedAt: v.updatedAt,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        ownerName: v.ownerName ?? null,
      })),
    });
  }

  grouped.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return grouped;
}

export function normalizeHeroName(name: string): string {
  return name.trim().toLowerCase();
}

export function findCharacterByName(
  characters: GroupedChargenCharacter[],
  name: string
): GroupedChargenCharacter | undefined {
  const key = normalizeHeroName(name);
  if (!key) return undefined;
  return characters.find((c) => normalizeHeroName(c.name) === key);
}

/** Prefer highest version number; tie-break by updatedAt. */
export function latestVersionOf(
  character: GroupedChargenCharacter
): GroupedChargenCharacter["versions"][number] {
  return character.versions.reduce((best, v) => {
    if (v.version > best.version) return v;
    if (v.version === best.version && toTime(v.updatedAt) > toTime(best.updatedAt)) {
      return v;
    }
    return best;
  });
}
