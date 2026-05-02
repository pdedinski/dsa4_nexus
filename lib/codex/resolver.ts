"use server";

import { db } from "@/lib/db/client";
import { codexSources, codexEntryVersions } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { loadFileData, FileData } from "./fileLoader";

export interface ResolvedEntry {
  id: string;
  payload: Record<string, unknown>;
  /** undefined = file origin, uuid string = DB version id */
  dbVersionId: string | undefined;
  versionLabel: string | undefined;
  hasDbVersions: boolean;
}

export interface ResolvedFile {
  meta: Record<string, unknown>;
  entries: ResolvedEntry[];
  /** For raw-only files (advancement_costs) */
  raw: Record<string, unknown>;
  sourceId: string | undefined;
}

/** Load all entries for a category+fileKey, merging DB defaults over file data. */
export async function resolveFile(
  category: string,
  fileKey: string
): Promise<ResolvedFile> {
  const fileData: FileData = loadFileData(category, fileKey);

  // Find source record in DB
  const [source] = await db
    .select()
    .from(codexSources)
    .where(
      and(
        eq(codexSources.category, category),
        eq(codexSources.fileKey, fileKey)
      )
    );

  if (!source) {
    // No DB source yet — return file data as-is
    return {
      meta: fileData.meta,
      raw: fileData.raw,
      sourceId: undefined,
      entries: fileData.items.map((item) => ({
        id: String(item.id ?? ""),
        payload: item,
        dbVersionId: undefined,
        versionLabel: undefined,
        hasDbVersions: false,
      })),
    };
  }

  // Load default DB versions for this source
  const dbDefaults = await db
    .select()
    .from(codexEntryVersions)
    .where(
      and(
        eq(codexEntryVersions.sourceId, source.id),
        eq(codexEntryVersions.isDefault, true)
      )
    );

  const defaultMap = new Map(dbDefaults.map((r) => [r.entryId, r]));

  // Check which entry_ids have any DB versions at all
  const allDbVersions = await db
    .select({ entryId: codexEntryVersions.entryId })
    .from(codexEntryVersions)
    .where(eq(codexEntryVersions.sourceId, source.id));

  const hasVersions = new Set(allDbVersions.map((r) => r.entryId));

  // Build entries from file items, overriding with DB default where present
  const fileIds = new Set(fileData.items.map((i) => String(i.id ?? "")));

  const entries: ResolvedEntry[] = fileData.items.map((item) => {
    const id = String(item.id ?? "");
    const dbRow = defaultMap.get(id);
    return {
      id,
      payload: dbRow
        ? (dbRow.payload as Record<string, unknown>)
        : item,
      dbVersionId: dbRow?.id,
      versionLabel: dbRow?.versionLabel ?? undefined,
      hasDbVersions: hasVersions.has(id),
    };
  });

  // Add DB-only entries (not in file)
  for (const [entryId, dbRow] of defaultMap.entries()) {
    if (!fileIds.has(entryId)) {
      entries.push({
        id: entryId,
        payload: dbRow.payload as Record<string, unknown>,
        dbVersionId: dbRow.id,
        versionLabel: dbRow.versionLabel ?? undefined,
        hasDbVersions: true,
      });
    }
  }

  return {
    meta: fileData.meta,
    raw: fileData.raw,
    sourceId: source.id,
    entries,
  };
}

/** Load all versions for one entry */
export async function getEntryVersions(sourceId: string, entryId: string) {
  return db
    .select()
    .from(codexEntryVersions)
    .where(
      and(
        eq(codexEntryVersions.sourceId, sourceId),
        eq(codexEntryVersions.entryId, entryId)
      )
    )
    .orderBy(codexEntryVersions.createdAt);
}
