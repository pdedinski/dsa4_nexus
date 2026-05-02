"use client";

import { useEffect, useState } from "react";
import BodyPortal from "@/components/ui/BodyPortal";
import EntryDetail from "@/components/codex/EntryDetail";
import { humanizeSnake } from "@/lib/display/humanize";

export type CodexPeekTarget =
  | { kind: "talent"; id: string }
  | { kind: "spell"; id: string }
  | { kind: "trait"; id: string }
  | { kind: "sa"; id: string }
  | { kind: "equipment"; id: string };

function buildUrl(t: CodexPeekTarget): string {
  const p = new URLSearchParams();
  if (t.kind === "talent") p.set("talentId", t.id);
  else if (t.kind === "spell") p.set("spellId", t.id);
  else if (t.kind === "trait") p.set("traitId", t.id);
  else if (t.kind === "sa") p.set("saId", t.id);
  else p.set("equipmentId", t.id);
  return `/api/codex/resolved-entry?${p}`;
}

function titleFromPayload(payload: Record<string, unknown>, fallback: string) {
  const n = payload.name;
  if (typeof n === "string" && n.trim()) return n.trim();
  return fallback;
}

export default function CodexEntryPeekModal({
  target,
  onClose,
}: {
  target: CodexPeekTarget | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setPayload(null);
      setError(null);
      setCategory(null);
      setFileKey(null);
      setVersionLabel(null);
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);
    fetch(buildUrl(target))
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.error ?? `Load failed (${r.status})`);
        }
        return data as {
          category: string;
          fileKey: string;
          payload: Record<string, unknown>;
          versionLabel?: string | null;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setCategory(data.category);
        setFileKey(data.fileKey);
        setPayload(data.payload);
        setVersionLabel(data.versionLabel ?? null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
    };
  }, [target]);

  if (!target) return null;

  const fallbackTitle = humanizeSnake(target.id);
  const title = payload
    ? titleFromPayload(payload, fallbackTitle)
    : fallbackTitle;

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[260] flex items-center justify-center bg-[#0a0705] p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="codex-peek-title"
      >
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close"
          onClick={onClose}
        />
        <div className="relative z-10 flex max-h-[min(92vh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-2xl">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-surface-border px-4 py-3">
            <div className="min-w-0">
              <h2
                id="codex-peek-title"
                className="truncate text-lg font-bold text-ink"
              >
                {title}
              </h2>
              {versionLabel && (
                <p className="text-xs text-ink-faint">Version: {versionLabel}</p>
              )}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-ink-muted hover:bg-surface-sidebar"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
            {loading && (
              <p className="text-ink-muted">Loading codex entry…</p>
            )}
            {error && (
              <p className="text-red-600 dark:text-red-400">{error}</p>
            )}
            {!loading && !error && payload && category && fileKey && (
              <EntryDetail
                payload={payload}
                category={category}
                fileKey={fileKey}
              />
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
