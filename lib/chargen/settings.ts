/**
 * Client-side chargen preferences (localStorage).
 */

export type ChargenFinishMode = "strict" | "advisory";

const STORAGE_KEY = "dsa-nexus-chargen-settings";

export interface ChargenSettings {
  finishMode: ChargenFinishMode;
}

const DEFAULTS: ChargenSettings = {
  finishMode: "strict",
};

export function loadChargenSettings(): ChargenSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ChargenSettings>;
    return {
      finishMode:
        parsed.finishMode === "advisory" ? "advisory" : "strict",
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveChargenSettings(settings: ChargenSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
