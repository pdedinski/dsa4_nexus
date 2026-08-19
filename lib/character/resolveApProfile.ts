import { eq } from "drizzle-orm";

import {
  DEFAULT_AP_PROFILE_ID,
  loadBundledApProfile,
  loadBundledDefaultApProfile,
  sortBandsByFrom,
} from "@/lib/character/apProfiles";
import type { ApSpendingBand, ApSpendingProfile } from "@/lib/character/types";
import { db } from "@/lib/db/client";
import { apSpendingProfiles } from "@/lib/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Loads the veteran AP spending profile for generation (`apProfileId` from wizard).
 * Built-in ids (`default` + archetype overrides) resolve from bundled JSON; UUIDs from DB.
 */
export async function resolveApSpendingProfileForGenerate(
  apProfileId: string | undefined | null
): Promise<ApSpendingProfile> {
  const id = apProfileId?.trim() ?? "";
  if (!id || id === DEFAULT_AP_PROFILE_ID) {
    return loadBundledDefaultApProfile();
  }

  const bundled = loadBundledApProfile(id);
  if (bundled) return bundled;

  if (!UUID_RE.test(id)) {
    return loadBundledDefaultApProfile();
  }

  const [row] = await db
    .select()
    .from(apSpendingProfiles)
    .where(eq(apSpendingProfiles.id, id))
    .limit(1);

  if (!row || row.bands === null || typeof row.bands !== "object") {
    return loadBundledDefaultApProfile();
  }
  const arr = Array.isArray(row.bands) ? row.bands : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    bands: sortBandsByFrom(arr as ApSpendingBand[]),
  };
}
