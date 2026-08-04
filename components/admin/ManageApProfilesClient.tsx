"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X, BadgeCheck } from "lucide-react";
import clsx from "clsx";
import type { ApSpendingBand } from "@/lib/character/types";

type ProfileRow = {
  id: string;
  name: string;
  description: string | null;
  bands: ApSpendingBand[];
  isBuiltin?: boolean;
  createdAt?: string;
};

const emptyBand = (): ApSpendingBand => ({
  from: 1,
  to: 100,
});

export default function ManageApProfilesClient() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftBands, setDraftBands] = useState<ApSpendingBand[]>([emptyBand()]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/ap-profiles");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to load profiles.");
      setProfiles([]);
      setLoading(false);
      return;
    }
    setProfiles((data.profiles as ProfileRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDraftName("");
    setDraftDescription("");
    setDraftBands([emptyBand()]);
    setModalOpen(true);
    setError(null);
  }

  function openEdit(p: ProfileRow) {
    if (p.isBuiltin) return;
    setEditing(p);
    setDraftName(p.name);
    setDraftDescription(p.description ?? "");
    setDraftBands(JSON.parse(JSON.stringify(p.bands)) as ApSpendingBand[]);
    setModalOpen(true);
    setError(null);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function updateBand(idx: number, patch: Partial<ApSpendingBand>) {
    setDraftBands((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx]!, ...patch };
      return next;
    });
  }

  function pctSlice(
    v: number | undefined,
    key:
      | "attributes"
      | "special_abilities"
      | "talents"
      | "spells",
  ): Partial<ApSpendingBand> {
    if (v === undefined || `${v}` === "" || Number.isNaN(Number(v))) return {};
    const n = Number(v);
    return { [key]: Math.min(100, Math.max(0, n)) } as Partial<ApSpendingBand>;
  }

  function bandsPayload(): ApSpendingBand[] {
    return draftBands.map((b) => {
      const rawTo = b.to;
      const normTo =
        rawTo === null ||
        rawTo === undefined ||
        String(rawTo) === "" ||
        !Number.isFinite(Number(rawTo))
          ? null
          : Number(rawTo);
      return {
        from: Number(b.from) >= 1 ? Number(b.from) : 1,
        to: normTo,
        ...pctSlice(b.attributes, "attributes"),
        ...pctSlice(b.special_abilities, "special_abilities"),
        ...pctSlice(b.talents, "talents"),
        ...pctSlice(b.spells, "spells"),
      };
    });
  }

  async function submitModal() {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        const res = await fetch(`/api/ap-profiles/${encodeURIComponent(editing.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draftName.trim(),
            description: draftDescription.trim() || "",
            bands: bandsPayload(),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Save failed.");
          setSaving(false);
          return;
        }
      } else {
        const res = await fetch("/api/ap-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draftName.trim(),
            description: draftDescription.trim() || undefined,
            bands: bandsPayload(),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Create failed.");
          setSaving(false);
          return;
        }
      }
      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile(id: string) {
    setError(null);
    const res = await fetch(`/api/ap-profiles/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Delete failed.");
    }
    setConfirmDeleteId(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Profiles split veteran AP by <strong className="text-ink">from</strong> /
        <strong className="text-ink"> to</strong> (1-based ordinals along the veteran
        pool). Use empty optional percents — remainder uses the normal talent/SP
        combined loop after each slice.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New profile
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-sidebar text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 hidden sm:table-cell">Bands</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-surface-border hover:bg-surface-sidebar/60"
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{p.name}</span>
                      {p.isBuiltin ? (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-muted px-2 py-0.5 text-xs font-medium text-ink">
                          <BadgeCheck className="h-3 w-3" />
                          Built-in
                        </span>
                      ) : null}
                    </div>
                    {p.description ? (
                      <p className="mt-1 text-xs text-ink-muted line-clamp-2">
                        {p.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-xs text-ink-muted sm:table-cell">
                    {(p.bands ?? []).length} band
                    {(p.bands ?? []).length === 1 ? "" : "s"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!p.isBuiltin ? (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => openEdit(p)}
                          className="rounded p-1.5 text-ink-muted hover:bg-surface-card hover:text-ink"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="rounded p-1.5 text-ink-muted hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-card p-4 shadow-xl">
            <p className="text-sm text-ink">Delete this profile?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => deleteProfile(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-surface-border bg-surface-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">
                {editing ? "Edit profile" : "New profile"}
              </h2>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-2 text-ink-muted hover:bg-surface-sidebar hover:text-ink"
                onClick={closeModal}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-ink-muted">Name</span>
              <input
                className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-2 py-2 text-ink scheme-dark"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-ink-muted">Description</span>
              <textarea
                rows={2}
                className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-2 py-2 text-ink scheme-dark"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
            </label>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Bands (from / to ordinal, percentages optional)
            </p>
            <div className="mt-2 space-y-3">
              {draftBands.map((b, idx) => (
                <div
                  key={`band-${idx}`}
                  className="rounded-lg border border-surface-border p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Band #{idx + 1}</span>
                    {draftBands.length > 1 ? (
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:underline"
                        onClick={() =>
                          setDraftBands((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      <span className="text-ink-muted">From (≥1)</span>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded border border-surface-border bg-surface-sidebar px-2 py-1.5 text-ink"
                        value={b.from}
                        onChange={(e) =>
                          updateBand(idx, { from: Number(e.target.value) || 1 })
                        }
                      />
                    </label>
                    <label className="text-xs">
                      <span className="text-ink-muted">To (blank = ∞)</span>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full rounded border border-surface-border bg-surface-sidebar px-2 py-1.5 text-ink"
                        value={b.to === null ? "" : b.to}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          updateBand(idx, {
                            to: v === "" ? null : Number(v),
                          });
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      ["attributes", "special_abilities", "talents", "spells"] as const
                    ).map((key) => (
                      <label key={key} className="text-xs">
                        <span className="text-ink-muted capitalize">
                          {key.replace("_", " ")} %
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="—"
                          className="mt-1 w-full rounded border border-surface-border bg-surface-sidebar px-2 py-1.5 text-ink"
                          value={
                            b[key] !== undefined &&
                            `${b[key]}` !== ""
                              ? Number(b[key])
                              : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value.trim();
                            if (v === "")
                              updateBand(idx, { [key]: undefined } as Partial<ApSpendingBand>);
                            else
                              updateBand(idx, {
                                [key]: Number(v),
                              } as Partial<ApSpendingBand>);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 text-sm text-brand-muted hover:underline"
              onClick={() => setDraftBands((prev) => [...prev, emptyBand()])}
            >
              + Add band
            </button>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !draftName.trim()}
                className={clsx(
                  "rounded-lg px-3 py-2 text-sm font-medium text-white bg-brand hover:opacity-90",
                  (saving || !draftName.trim()) && "opacity-50 cursor-not-allowed",
                )}
                onClick={() => submitModal()}
              >
                {saving ? "Saving…" : editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
