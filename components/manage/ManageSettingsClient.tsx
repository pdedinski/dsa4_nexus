"use client";

import { useEffect, useState } from "react";

const DEBUG_MODE_STORAGE_KEY = "dsa_debug_mode";
export const DEBUG_MODE_CHANGED_EVENT = "dsa-debug-mode-changed";

function readDebugPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(DEBUG_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDebugPreference(on: boolean) {
  try {
    globalThis.localStorage?.setItem(DEBUG_MODE_STORAGE_KEY, on ? "1" : "0");
    globalThis.dispatchEvent(new Event(DEBUG_MODE_CHANGED_EVENT));
  } catch {
    /* ignore quota / SSR */
  }
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full border border-surface-border transition-colors disabled:opacity-50 ${
        checked ? "bg-brand" : "bg-surface-sidebar"
      }`}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
          checked ? "left-7" : "left-1"
        }`}
      />
    </button>
  );
}

export default function ManageSettingsClient() {
  const [hydrated, setHydrated] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [sharedVisibility, setSharedVisibility] = useState(true);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedSaving, setSharedSaving] = useState(false);
  const [sharedError, setSharedError] = useState<string | null>(null);

  useEffect(() => {
    setDebugMode(readDebugPreference());
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSharedLoading(true);
      setSharedError(null);
      try {
        const res = await fetch("/api/manage/app-settings");
        if (!res.ok) {
          throw new Error("Failed to load settings");
        }
        const data = (await res.json()) as {
          chargenHeroesSharedVisibility?: boolean;
        };
        if (!cancelled) {
          setSharedVisibility(data.chargenHeroesSharedVisibility !== false);
        }
      } catch (err) {
        if (!cancelled) {
          setSharedError(
            err instanceof Error ? err.message : "Failed to load settings"
          );
        }
      } finally {
        if (!cancelled) setSharedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSharedVisibility(next: boolean) {
    setSharedSaving(true);
    setSharedError(null);
    const previous = sharedVisibility;
    setSharedVisibility(next);
    try {
      const res = await fetch("/api/manage/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargenHeroesSharedVisibility: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || "Failed to save setting");
      }
    } catch (err) {
      setSharedVisibility(previous);
      setSharedError(
        err instanceof Error ? err.message : "Failed to save setting"
      );
    } finally {
      setSharedSaving(false);
    }
  }

  if (!hydrated) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">
        Debug Mode applies only to your browser. Chargen character visibility is
        site-wide and applies to every user when loading heroes from the
        database.
      </p>

      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Debug Mode</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Off by default. When on, character generation returns a detailed
              GP/AP trace (visible in the preview toolbar on the Characters
              page).
            </p>
          </div>
          <ToggleSwitch
            checked={debugMode}
            onChange={(next) => {
              setDebugMode(next);
              writeDebugPreference(next);
            }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Shared chargen characters
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              When enabled, all users can see and load every character saved in
              the Player Character Generator. When disabled, non-admin users
              only see characters they created; admins and superusers still see
              all.
            </p>
          </div>
          <ToggleSwitch
            checked={sharedVisibility}
            disabled={sharedLoading || sharedSaving}
            onChange={(next) => {
              void saveSharedVisibility(next);
            }}
          />
        </div>
        {sharedLoading && (
          <p className="mt-2 text-xs text-ink-muted">Loading…</p>
        )}
        {sharedError && (
          <p className="mt-2 text-xs text-red-400">{sharedError}</p>
        )}
      </div>
    </div>
  );
}
