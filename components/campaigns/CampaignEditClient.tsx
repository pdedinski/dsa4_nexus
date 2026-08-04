"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";
import {
  useCampaign,
  type CampaignSummary,
} from "@/components/campaigns/CampaignContext";
import ThumbnailImage from "@/components/images/ThumbnailImage";

type CharacterAsset = {
  id: string;
  characterId: string;
  name: string;
  assigned: boolean;
};
type NoteAsset = { id: string; title: string; assigned: boolean };
type ImageAsset = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  assigned: boolean;
};

type AssetSectionKey = "characters" | "notes" | "images";

export default function CampaignEditClient({
  campaignId,
}: {
  campaignId: string;
}) {
  const router = useRouter();
  const { removeCampaignLocal, upsertCampaignLocal } = useCampaign();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [characters, setCharacters] = useState<CharacterAsset[]>([]);
  const [notes, setNotes] = useState<NoteAsset[]>([]);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  const [openSections, setOpenSections] = useState<Set<AssetSectionKey>>(
    new Set(["characters"])
  );
  const [charFilter, setCharFilter] = useState("");
  const [noteFilter, setNoteFilter] = useState("");
  const [imageFilter, setImageFilter] = useState("");
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const loadCampaign = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to load campaign.");
      setLoading(false);
      return;
    }
    const c = data.campaign as CampaignSummary;
    setName(c.name);
    setDescription(c.description ?? "");
    upsertCampaignLocal(c);
    setLoading(false);
  }, [campaignId, upsertCampaignLocal]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    const res = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/assets`
    );
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setCharacters((data.characters as CharacterAsset[]) ?? []);
      setNotes((data.notes as NoteAsset[]) ?? []);
      setImages((data.images as ImageAsset[]) ?? []);
    }
    setAssetsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void loadCampaign();
    void loadAssets();
  }, [loadCampaign, loadAssets]);

  function toggleSection(key: AssetSectionKey) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveMeta() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${encodeURIComponent(campaignId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed.");
        return;
      }
      upsertCampaignLocal(data.campaign as CampaignSummary);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCampaign() {
    setDeleting(true);
    setError(null);
    const res = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    setDeleting(false);
    if (!res.ok) {
      setError(data.error ?? "Delete failed.");
      setConfirmDelete(false);
      return;
    }
    removeCampaignLocal(campaignId);
    router.push("/campaigns");
  }

  async function toggleAsset(
    assetType: "character" | "note" | "image",
    assetId: string,
    currentlyAssigned: boolean
  ) {
    const key = `${assetType}:${assetId}`;
    setTogglingKey(key);
    setError(null);

    // Optimistic update
    if (assetType === "character") {
      setCharacters((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, assigned: !currentlyAssigned } : a
        )
      );
    } else if (assetType === "note") {
      setNotes((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, assigned: !currentlyAssigned } : a
        )
      );
    } else {
      setImages((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, assigned: !currentlyAssigned } : a
        )
      );
    }

    const method = currentlyAssigned ? "DELETE" : "POST";
    const res = await fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/assets/${assetType}/${encodeURIComponent(assetId)}`,
      { method }
    );
    if (!res.ok) {
      // Revert
      if (assetType === "character") {
        setCharacters((prev) =>
          prev.map((a) =>
            a.id === assetId ? { ...a, assigned: currentlyAssigned } : a
          )
        );
      } else if (assetType === "note") {
        setNotes((prev) =>
          prev.map((a) =>
            a.id === assetId ? { ...a, assigned: currentlyAssigned } : a
          )
        );
      } else {
        setImages((prev) =>
          prev.map((a) =>
            a.id === assetId ? { ...a, assigned: currentlyAssigned } : a
          )
        );
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update assignment.");
    }
    setTogglingKey(null);
  }

  const filteredCharacters = useMemo(() => {
    const q = charFilter.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.characterId.toLowerCase().includes(q)
    );
  }, [characters, charFilter]);

  const filteredNotes = useMemo(() => {
    const q = noteFilter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) =>
      (n.title?.trim() || "Untitled").toLowerCase().includes(q)
    );
  }, [notes, noteFilter]);

  const filteredImages = useMemo(() => {
    const q = imageFilter.trim().toLowerCase();
    if (!q) return images;
    return images.filter((i) => i.name.toLowerCase().includes(q));
  }, [images, imageFilter]);

  if (loading) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 rounded-lg border border-surface-border px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {error && (
        <p
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="rounded-lg border border-surface-border bg-surface-card p-4 space-y-3">
        <label className="block text-sm">
          <span className="text-ink-muted">Name</span>
          <input
            className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-ink scheme-dark"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-ink-muted">Description</span>
          <textarea
            rows={3}
            className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-ink scheme-dark"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={saving || !name.trim()}
            className={clsx(
              "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90",
              (saving || !name.trim()) && "cursor-not-allowed opacity-50"
            )}
            onClick={() => void saveMeta()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete campaign
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Assets
        </h2>
        {assetsLoading ? (
          <p className="text-sm text-ink-muted">Loading assets…</p>
        ) : (
          <>
            {/* Characters accordion */}
            <section className="rounded-lg border border-surface-border bg-surface-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-surface-sidebar/60"
                onClick={() => toggleSection("characters")}
              >
                {openSections.has("characters") ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">Characters</span>
                <span className="text-xs font-normal text-ink-muted">
                  {characters.filter((c) => c.assigned).length}/
                  {characters.length}
                </span>
              </button>
              {openSections.has("characters") && (
                <div className="border-t border-surface-border px-3 pb-3 pt-2">
                  <input
                    type="search"
                    placeholder="Filter characters…"
                    value={charFilter}
                    onChange={(e) => setCharFilter(e.target.value)}
                    className="mb-2 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-sm text-ink scheme-dark"
                  />
                  {filteredCharacters.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-ink-muted">
                      No characters found.
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {filteredCharacters.map((c) => {
                        const busy = togglingKey === `character:${c.id}`;
                        return (
                          <li key={c.id}>
                            <label
                              className={clsx(
                                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-sidebar/80",
                                busy && "opacity-60"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 shrink-0"
                                checked={c.assigned}
                                disabled={busy}
                                onChange={() =>
                                  void toggleAsset(
                                    "character",
                                    c.id,
                                    c.assigned
                                  )
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-ink">
                                  {c.name}
                                </span>
                                <span className="block truncate font-mono text-xs text-ink-faint">
                                  {c.characterId}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Notes accordion */}
            <section className="rounded-lg border border-surface-border bg-surface-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-surface-sidebar/60"
                onClick={() => toggleSection("notes")}
              >
                {openSections.has("notes") ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">Notes</span>
                <span className="text-xs font-normal text-ink-muted">
                  {notes.filter((n) => n.assigned).length}/{notes.length}
                </span>
              </button>
              {openSections.has("notes") && (
                <div className="border-t border-surface-border px-3 pb-3 pt-2">
                  <input
                    type="search"
                    placeholder="Filter notes…"
                    value={noteFilter}
                    onChange={(e) => setNoteFilter(e.target.value)}
                    className="mb-2 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-sm text-ink scheme-dark"
                  />
                  {filteredNotes.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-ink-muted">
                      No notes found.
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {filteredNotes.map((n) => {
                        const busy = togglingKey === `note:${n.id}`;
                        return (
                          <li key={n.id}>
                            <label
                              className={clsx(
                                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-sidebar/80",
                                busy && "opacity-60"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 shrink-0"
                                checked={n.assigned}
                                disabled={busy}
                                onChange={() =>
                                  void toggleAsset("note", n.id, n.assigned)
                                }
                              />
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                {n.title?.trim() || "Untitled"}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Images accordion */}
            <section className="rounded-lg border border-surface-border bg-surface-card overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-surface-sidebar/60"
                onClick={() => toggleSection("images")}
              >
                {openSections.has("images") ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">Images</span>
                <span className="text-xs font-normal text-ink-muted">
                  {images.filter((i) => i.assigned).length}/{images.length}
                </span>
              </button>
              {openSections.has("images") && (
                <div className="border-t border-surface-border px-3 pb-3 pt-2">
                  <input
                    type="search"
                    placeholder="Filter images…"
                    value={imageFilter}
                    onChange={(e) => setImageFilter(e.target.value)}
                    className="mb-2 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-sm text-ink scheme-dark"
                  />
                  {filteredImages.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-ink-muted">
                      No images found.
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                      {filteredImages.map((img) => {
                        const busy = togglingKey === `image:${img.id}`;
                        return (
                          <li key={img.id}>
                            <label
                              className={clsx(
                                "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-sidebar/80",
                                busy && "opacity-60"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 shrink-0"
                                checked={img.assigned}
                                disabled={busy}
                                onChange={() =>
                                  void toggleAsset(
                                    "image",
                                    img.id,
                                    img.assigned
                                  )
                                }
                              />
                              <ThumbnailImage
                                thumbnailUrl={img.thumbnailUrl}
                                originalUrl={img.url}
                                className="h-8 w-8 shrink-0 rounded object-cover border border-surface-border"
                              />
                              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                                {img.name}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {confirmDelete && (
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
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={() => void deleteCampaign()}
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
