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

export default function ManageSettingsClient() {
  const [hydrated, setHydrated] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    setDebugMode(readDebugPreference());
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-ink-muted">
        Settings here apply only to your browser. Generation debug traces are collected on the server
        when you create a character; they appear in the preview on the Characters page when Debug
        Mode is on.
      </p>

      <div className="rounded-lg border border-surface-border bg-surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Debug Mode</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Off by default. When on, character generation returns a detailed GP/AP trace (visible in
              the preview toolbar on the Characters page).
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={debugMode}
            onClick={() => {
              const next = !debugMode;
              setDebugMode(next);
              writeDebugPreference(next);
            }}
            className={`relative h-8 w-14 shrink-0 rounded-full border border-surface-border transition-colors ${
              debugMode ? "bg-brand" : "bg-surface-sidebar"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                debugMode ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
