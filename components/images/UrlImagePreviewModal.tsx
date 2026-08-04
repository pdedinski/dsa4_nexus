"use client";

import { useEffect } from "react";
import BodyPortal from "@/components/ui/BodyPortal";

/** Modal: show an image from a known URL (no API fetch). */
export default function UrlImagePreviewModal({
  url,
  label,
  onClose,
}: {
  url: string | null;
  label?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!url) return;
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
  }, [url, onClose]);

  if (!url) return null;

  const title = label?.trim() || "Image";

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[210] flex flex-col bg-black/80"
        onClick={onClose}
      >
        <div
          className="mx-auto my-4 flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-surface-border bg-[#1a1410] shadow-2xl md:my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
            <h2 className="truncate font-bold text-ink">{title}</h2>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={title}
              className="max-h-[75vh] max-w-full object-contain rounded"
            />
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
