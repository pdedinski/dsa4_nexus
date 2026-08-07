/**
 * Site-wide app settings (DB-backed).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";

/** When true, all allowed users can list/load all chargen heroes. */
export const CHARGEN_HEROES_SHARED_VISIBILITY_KEY =
  "chargen.heroes.sharedVisibility";

/** Default matches historical behavior (everyone sees everyone). */
export const CHARGEN_HEROES_SHARED_VISIBILITY_DEFAULT = true;

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return fallback;
}

export async function getAppSettingBool(
  key: string,
  fallback: boolean
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    if (!row) return fallback;
    return asBoolean(row.value, fallback);
  } catch (err) {
    console.warn(`[appSettings] get ${key} failed`, err);
    return fallback;
  }
}

export async function setAppSettingBool(
  key: string,
  value: boolean,
  updatedBy?: string | null
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      key,
      value,
      updatedAt: new Date(),
      updatedBy: updatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value,
        updatedAt: new Date(),
        updatedBy: updatedBy ?? null,
      },
    });
}

export async function getChargenHeroesSharedVisibility(): Promise<boolean> {
  return getAppSettingBool(
    CHARGEN_HEROES_SHARED_VISIBILITY_KEY,
    CHARGEN_HEROES_SHARED_VISIBILITY_DEFAULT
  );
}

export function isAdminOrSuperuser(session: {
  user: { isAdmin?: boolean; isSuperuser?: boolean };
}): boolean {
  return !!(session.user.isAdmin || session.user.isSuperuser);
}

/** Whether the session may view a hero with the given creator. */
export function canViewChargenHero(
  session: {
    user: { id: string; isAdmin?: boolean; isSuperuser?: boolean };
  },
  createdBy: string | null,
  sharedVisibility: boolean
): boolean {
  if (sharedVisibility) return true;
  if (isAdminOrSuperuser(session)) return true;
  return createdBy != null && createdBy === session.user.id;
}
