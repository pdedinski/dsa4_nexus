"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ImageRow = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
};

type SortBy = "createdAt" | "name";
type SortDir = "desc" | "asc";

export default function MyImagesList() {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteFromCloud, setDeleteFromCloud] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sortedImages = useMemo(() => {
    const copy = [...images];
    const cmpNum = (a: number, b: number) =>
      sortDir === "desc" ? b - a : a - b;
    copy.sort((a, b) => {
      if (sortBy === "name") {
        const ta = a.name.toLocaleLowerCase();
        const tb = b.name.toLocaleLowerCase();
        const c = ta.localeCompare(tb);
        return sortDir === "desc" ? -c : c;
      }
      return cmpNum(
        new Date(a.createdAt).getTime(),
        new Date(b.createdAt).getTime()
      );
    });
    return copy;
  }, [images, sortBy, sortDir]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/images");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load images");
      setLoading(false);
      return;
    }
    setImages(data.images ?? []);
    setCloudinaryConfigured(data.cloudinaryConfigured !== false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadImage() {
    if (!file) {
      setError("Choose an image file to upload");
      return;
    }
    if (!name.trim()) {
      setError("Enter a name for the image");
      return;
    }
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("name", name.trim());
    const res = await fetch("/api/images", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setName("");
    setFile(null);
    const input = document.getElementById("image-file-input") as HTMLInputElement | null;
    if (input) input.value = "";
    void load();
  }

  async function deleteImage(id: string) {
    setDeleting(true);
    setError(null);
    const qs = deleteFromCloud ? "?deleteFromCloud=true" : "";
    const res = await fetch(`/api/images/${encodeURIComponent(id)}${qs}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setDeleting(false);
    setConfirmDeleteId(null);
    setDeleteFromCloud(false);
    if (!res.ok) {
      setError(data.error ?? "Delete failed");
      return;
    }
    void load();
  }

  return (
    <div>
      {!cloudinaryConfigured && (
        <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          Cloudinary is not configured on this server. Set{" "}
          <code className="text-xs">CLOUDINARY_CLOUD_NAME</code>,{" "}
          <code className="text-xs">CLOUDINARY_API_KEY</code>, and{" "}
          <code className="text-xs">CLOUDINARY_API_SECRET</code> in{" "}
          <code className="text-xs">.env</code> to enable uploads.
        </p>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mb-6 rounded-lg border border-surface-border bg-surface-card p-4">
        <h2 className="text-sm font-semibold text-ink mb-3">Upload image</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold uppercase text-ink-muted mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!cloudinaryConfigured || uploading}
              className="w-full rounded-lg border border-surface-border bg-[#110e0a] px-3 py-2 text-sm text-ink disabled:opacity-50"
              placeholder="e.g. Tavern map"
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold uppercase text-ink-muted mb-1">
              File
            </label>
            <input
              id="image-file-input"
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
            disabled={!cloudinaryConfigured || uploading}
            onClick={() => void uploadImage()}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {!loading && images.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="sr-only" htmlFor="images-sort-by">
            Sort images by
          </label>
          <select
            id="images-sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-lg border border-surface-border bg-[#110e0a] px-2 py-1.5 text-sm text-ink"
          >
            <option value="createdAt">Added date</option>
            <option value="name">Name</option>
          </select>
          <label className="sr-only" htmlFor="images-sort-dir">
            Sort direction
          </label>
          <select
            id="images-sort-dir"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as SortDir)}
            className="rounded-lg border border-surface-border bg-[#110e0a] px-2 py-1.5 text-sm text-ink"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No images yet. Upload one to use it in notes with{" "}
          <kbd className="rounded border border-surface-border px-1">^</kbd> while editing.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedImages.map((img) => (
            <li
              key={img.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-surface-border bg-surface-card px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="h-12 w-12 shrink-0 rounded object-cover border border-surface-border"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink truncate">{img.name}</p>
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-brand-muted hover:text-brand truncate"
                >
                  {img.url}
                </a>
                <p className="text-xs text-ink-faint mt-0.5">
                  Added {new Date(img.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg border border-red-900/50 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/30"
                onClick={() => {
                  setDeleteFromCloud(false);
                  setConfirmDeleteId(img.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-card p-4 shadow-xl">
            <p className="text-sm text-ink">Delete this image from your library?</p>
            {cloudinaryConfigured ? (
              <label className="mt-3 flex items-start gap-2 text-sm text-ink-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteFromCloud}
                  onChange={(e) => setDeleteFromCloud(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Also delete from Cloudinary storage</span>
              </label>
            ) : (
              <p className="mt-2 text-xs text-ink-faint">
                Cloudinary is not configured; only the database record will be removed.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
                disabled={deleting}
                onClick={() => {
                  setConfirmDeleteId(null);
                  setDeleteFromCloud(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
                onClick={() => void deleteImage(confirmDeleteId)}
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
