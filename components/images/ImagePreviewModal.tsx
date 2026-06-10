"use client";

import { useEffect, useState } from "react";
import BodyPortal from "@/components/ui/BodyPortal";

export type ImagePreviewTarget = {
  id: string;
  fallbackUrl?: string;
  fallbackLabel?: string;
};

/** Modal: show a stored image by id (or fallback URL from mention attrs). */
export default function ImagePreviewModal({
  target,
  onClose,
}: {
  target: ImagePreviewTarget | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) {
      setName("");
      setUrl(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);
    setName(target.fallbackLabel ?? "");

    void (async () => {
      const res = await fetch(
        `/api/images/${encodeURIComponent(target.id)}`
      );
      const data = await res.json();
      if (cancelled) return;
      setLoading(false);
      if (res.ok && data.image) {
        setName(data.image.name as string);
        setUrl(data.image.url as string);
        return;
      }
      if (target.fallbackUrl) {
        setUrl(target.fallbackUrl);
        if (!target.fallbackLabel) setName("Image");
        return;
      }
      setError(data.error ?? "Image not found");
    })();

    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [target, onClose]);

  if (!target) return null;

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[200] flex flex-col bg-black/80"
        onClick={onClose}
      >
        <div
          className="mx-auto my-4 flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-[#1a1410] shadow-2xl md:my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
            <h2 className="truncate font-bold text-ink">
              {loading ? "Loading…" : name || target.id}
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            {!loading && url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={name}
                className="max-h-[75vh] max-w-full object-contain rounded"
              />
            )}
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
