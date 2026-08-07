"use client";

import { useEffect } from "react";
import BodyPortal from "@/components/ui/BodyPortal";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm action as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl"
        >
          <h2
            id="confirm-dialog-title"
            className="text-lg font-bold text-ink"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={
                danger
                  ? "rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                  : "rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              }
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
