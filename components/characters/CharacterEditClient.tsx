"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CharacterSheet } from "@/lib/character/types";

export default function CharacterEditClient({ characterId }: { characterId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sheetJson, setSheetJson] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/characters/${encodeURIComponent(characterId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.sheet) throw new Error(d.error ?? "Load failed");
        setName(d.name ?? "");
        setSheetJson(JSON.stringify(d.sheet, null, 2));
        setImageUrl(d.imageUrl ?? null);
        setCloudinaryConfigured(d.cloudinaryConfigured !== false);
      })
      .catch((e) => setError(String(e.message)))
      .finally(() => setLoading(false));
  }, [characterId]);

  async function save() {
    setError(null);
    let sheet: CharacterSheet;
    try {
      sheet = JSON.parse(sheetJson) as CharacterSheet;
    } catch {
      setError("Invalid JSON in sheet");
      return;
    }
    const res = await fetch(`/api/characters/${encodeURIComponent(characterId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sheet }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Save failed");
      return;
    }
    router.push(`/characters/${encodeURIComponent(characterId)}`);
  }

  async function uploadImage() {
    if (!file) {
      setError("Choose an image file to upload");
      return;
    }
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      `/api/characters/${encodeURIComponent(characterId)}/image`,
      { method: "POST", body: form }
    );
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setImageUrl(data.imageUrl ?? null);
    setFile(null);
    const input = document.getElementById(
      "character-image-file-input"
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function removeImage() {
    if (!confirm("Remove this character image? It will be deleted from cloud storage."))
      return;
    setRemovingImage(true);
    setError(null);
    const res = await fetch(
      `/api/characters/${encodeURIComponent(characterId)}/image`,
      { method: "DELETE" }
    );
    const data = await res.json();
    setRemovingImage(false);
    if (!res.ok) {
      setError(data.error ?? "Remove failed");
      return;
    }
    setImageUrl(null);
    setFile(null);
    const input = document.getElementById(
      "character-image-file-input"
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  }

  if (loading) return <p className="p-6 text-ink-muted">Loading…</p>;
  if (error && !sheetJson)
    return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <Link href="/characters" className="text-brand">
          ← My Characters
        </Link>
        <Link
          href={`/characters/${encodeURIComponent(characterId)}`}
          className="text-ink-muted"
        >
          View
        </Link>
      </div>
      <h1 className="text-xl font-bold text-ink">Edit character</h1>
      <label className="block text-sm">
        <span className="text-ink-muted">Display name</span>
        <input
          className="mt-1 w-full max-w-md rounded border border-surface-border bg-surface-sidebar px-2 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="rounded-lg border border-surface-border bg-surface-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-ink">Character image</h2>
        {!cloudinaryConfigured && (
          <p className="text-sm text-amber-200 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
            Cloudinary is not configured on this server. Image upload is unavailable.
          </p>
        )}
        {imageUrl ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand font-medium"
            >
              View current image
            </a>
            <button
              type="button"
              className="text-red-600 dark:text-red-400 disabled:opacity-50"
              disabled={!cloudinaryConfigured || removingImage}
              onClick={() => void removeImage()}
            >
              {removingImage ? "Removing…" : "Remove image"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No image uploaded.</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold uppercase text-ink-muted mb-1">
              {imageUrl ? "Replace image" : "Upload image"}
            </label>
            <input
              id="character-image-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={!cloudinaryConfigured || uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-ink-muted file:mr-2 file:rounded file:border-0 file:bg-brand-muted file:px-3 file:py-1.5 file:text-sm file:text-ink disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!cloudinaryConfigured || uploading || !file}
            onClick={() => void uploadImage()}
          >
            {uploading ? "Uploading…" : imageUrl ? "Upload replacement" : "Upload"}
          </button>
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-ink-muted">Sheet JSON</span>
        <textarea
          className="mt-1 w-full h-[60vh] font-mono text-xs rounded border border-surface-border bg-surface-sidebar p-2 text-ink"
          value={sheetJson}
          onChange={(e) => setSheetJson(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium"
        onClick={() => void save()}
      >
        Save
      </button>
    </div>
  );
}
