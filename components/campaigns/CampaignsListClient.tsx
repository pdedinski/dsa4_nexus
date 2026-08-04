"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import {
  useCampaign,
  type CampaignSummary,
} from "@/components/campaigns/CampaignContext";

export default function CampaignsListClient() {
  const { campaigns, refreshCampaigns, removeCampaignLocal, upsertCampaignLocal } =
    useCampaign();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await refreshCampaigns();
    setLoading(false);
  }, [refreshCampaigns]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setDraftName("");
    setDraftDescription("");
    setError(null);
    setModalOpen(true);
  }

  async function submitCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDescription.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Create failed.");
        setSaving(false);
        return;
      }
      const c = data.campaign as CampaignSummary;
      upsertCampaignLocal(c);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign(id: string) {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    setConfirmDeleteId(null);
    if (!res.ok) {
      setError(data.error ?? "Delete failed.");
      return;
    }
    removeCampaignLocal(id);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {error && (
        <p
          className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No campaigns yet. Create one to group characters, notes, and images.
        </p>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/campaigns/${encodeURIComponent(c.id)}`}
                  className="font-medium text-ink hover:text-brand"
                >
                  {c.name}
                </Link>
                {c.description ? (
                  <p className="mt-1 text-xs text-ink-muted line-clamp-2">
                    {c.description}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/campaigns/${encodeURIComponent(c.id)}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar hover:text-ink"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
                <button
                  type="button"
                  title="Delete"
                  className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 px-3 py-2 text-sm text-red-400 hover:bg-red-950/30"
                  onClick={() => setConfirmDeleteId(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">New campaign</h2>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-2 text-ink-muted hover:bg-surface-sidebar hover:text-ink"
                onClick={() => setModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-ink-muted">Name</span>
              <input
                className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-ink scheme-dark"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-ink-muted">Description</span>
              <textarea
                rows={3}
                className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-ink scheme-dark"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draftName.trim()}
                className={clsx(
                  "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90",
                  (saving || !draftName.trim()) && "cursor-not-allowed opacity-50"
                )}
                onClick={() => void submitCreate()}
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
            <p className="text-sm text-ink">
              Delete this campaign? Assets will be unassigned but not deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
                disabled={deleting}
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={() => void deleteCampaign(confirmDeleteId)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
