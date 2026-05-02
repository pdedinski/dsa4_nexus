"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Check, Trash2 } from "lucide-react";
import CodexModalPortal from "./CodexModalPortal";

interface Version {
  id: string;
  versionLabel: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface Props {
  sourceId: string;
  entryId: string;
  onClose: () => void;
  /** Only editors may delete versions (API enforces this too). */
  isEditor: boolean;
  /** Called after a successful delete so the parent can refresh server data (e.g. default badges). */
  onVersionsMutated?: () => void;
}

export default function VersionModal({
  sourceId,
  entryId,
  onClose,
  isEditor,
  onVersionsMutated,
}: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refetchVersions = useCallback(async () => {
    const r = await fetch(
      `/api/codex/versions?sourceId=${sourceId}&entryId=${encodeURIComponent(entryId)}`
    );
    const data = await r.json().catch(() => ({}));
    setVersions(Array.isArray(data.versions) ? data.versions : []);
  }, [sourceId, entryId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refetchVersions()
      .catch(() => {
        if (!cancelled) setVersions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchVersions]);

  async function setDefault(versionId: string) {
    setSaving(versionId);
    await fetch("/api/codex/versions/set-default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    setSaving(null);
    onClose();
    window.location.reload();
  }

  async function deleteVersion(versionId: string, label: string) {
    if (
      !confirm(
        `Delete version "${label}" permanently? This cannot be undone.`
      )
    )
      return;
    setDeleteError(null);
    setDeleting(versionId);
    const res = await fetch("/api/codex/versions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    if (!res.ok) {
      setDeleting(null);
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error ?? "Delete failed.");
      return;
    }
    setDeleting(null);
    setDeleteError(null);
    try {
      await refetchVersions();
      onVersionsMutated?.();
    } catch {
      setDeleteError("Version was deleted but the list could not be refreshed.");
    }
  }

  return (
    <Modal title={`Versions — ${entryId}`} onClose={onClose}>
      {loading ? (
        <p className="text-ink-muted text-sm text-center py-6">Loading…</p>
      ) : versions.length === 0 ? (
        <p className="text-ink-muted text-sm text-center py-6">
          No saved versions yet.
        </p>
      ) : (
        <div className="space-y-2">
          {deleteError && (
            <p className="text-xs text-red-400 px-1">{deleteError}</p>
          )}
          {versions.map((v) => {
            const label = v.versionLabel ?? "Version";
            const busy = saving === v.id || deleting === v.id;
            return (
              <div
                key={v.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1410] border border-[#3a2e26]"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-ink text-sm">{label}</span>
                  <span className="text-ink-muted text-xs ml-2">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                  {v.isDefault && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-brand-muted text-brand-light border border-brand">
                      default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!v.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(v.id)}
                      disabled={busy}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand hover:bg-brand-dark text-white transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      Set default
                    </button>
                  )}
                  {isEditor && (
                    <button
                      type="button"
                      title="Delete version"
                      onClick={() => deleteVersion(v.id, label)}
                      disabled={busy}
                      className="flex items-center justify-center p-1.5 rounded text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <CodexModalPortal>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#050403]/90 backdrop-blur-sm"
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-xl border border-[#3a2e26] bg-[#231c16] shadow-2xl ring-1 ring-black/50"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#3a2e26] bg-[#231c16] rounded-t-xl">
            <h2 className="text-ink font-semibold text-sm">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 bg-[#231c16] rounded-b-xl">{children}</div>
        </div>
      </div>
    </CodexModalPortal>
  );
}
