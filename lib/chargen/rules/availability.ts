/**
 * Race ↔ culture ↔ profession pairing (Java PanelKultur / PanelProfession).
 * Soft rules: incompatible options stay selectable but are marked unavailable.
 */

export type CultureProfessionFilter = {
  mode?: string;
  exclude?: string[];
  include?: string[];
};

export function isCultureAllowedForRace(
  race: { allowed_cultures?: string[] } | null | undefined,
  cultureId: string
): boolean {
  if (!cultureId) return false;
  const allowed = race?.allowed_cultures;
  if (!allowed?.length) return true;
  return allowed.includes(cultureId);
}

/**
 * Older XML imports treated AlleVon as `mode: "list"` with an empty `include`,
 * which blocks every profession. Prefer the builtin allow-list when that happens.
 */
export function resolveCultureProfessionFilter(
  custom: CultureProfessionFilter | null | undefined,
  builtin: CultureProfessionFilter | null | undefined
): CultureProfessionFilter | undefined {
  if (!custom) return builtin ?? undefined;
  if (!builtin) return custom;
  const mode = custom.mode;
  if (
    (mode === "list" || mode === "none_except") &&
    !(custom.include?.length) &&
    ((builtin.include?.length ?? 0) > 0 ||
      builtin.mode === "all" ||
      builtin.mode === "all_except" ||
      !builtin.mode)
  ) {
    return builtin;
  }
  return custom;
}

export function isProfessionAllowedForCulture(
  culture: { professions?: CultureProfessionFilter } | null | undefined,
  professionId: string
): boolean {
  if (!professionId) return false;
  const p = culture?.professions;
  if (!p?.mode || p.mode === "all") return true;
  if (p.mode === "all_except") {
    return !p.exclude?.includes(professionId);
  }
  if (p.mode === "list" || p.mode === "none_except") {
    const include = p.include ?? [];
    // AlleVon / none_except: only listed professions are allowed.
    // Empty include means none (not "all") — matches Java AlleVon.
    return include.includes(professionId);
  }
  return true;
}
