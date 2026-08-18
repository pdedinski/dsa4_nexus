"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import BodyPortal from "@/components/ui/BodyPortal";

export type CombatantDraft = {
  name: string;
  ini: number;
  vp: number;
  asp: number;
  ar: number;
  comment: string;
};

const EMPTY_DRAFT: CombatantDraft = {
  name: "",
  ini: 0,
  vp: 0,
  asp: 0,
  ar: 0,
  comment: "",
};

export default function AddCombatantModal({
  open,
  title = "Add Combatant",
  initial,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title?: string;
  initial?: CombatantDraft | null;
  saving: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (draft: CombatantDraft) => void;
}) {
  const [draft, setDraft] = useState<CombatantDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (open) {
      setDraft(initial ? { ...initial } : { ...EMPTY_DRAFT });
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  function setNum(key: "ini" | "vp" | "asp" | "ar", raw: string) {
    const n = raw === "" ? 0 : Math.trunc(Number(raw));
    setDraft((d) => ({
      ...d,
      [key]: Number.isFinite(n) ? n : 0,
    }));
  }

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-md rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl"
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              className="rounded p-2 text-ink-muted hover:bg-surface-sidebar hover:text-ink"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error ? (
            <p
              className="mb-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="text-ink-muted">Combatant Name</span>
            <input
              className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-ink scheme-dark"
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              autoFocus
            />
          </label>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["ini", "INI"],
                ["vp", "VP"],
                ["asp", "ASP"],
                ["ar", "AR"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm">
                <span className="text-ink-muted">{label}</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-2 py-2 font-mono tabular-nums text-ink scheme-dark"
                  value={draft[key]}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </label>
            ))}
          </div>

          <label className="mt-3 block text-sm">
            <span className="text-ink-muted">Comment</span>
            <textarea
              rows={2}
              placeholder="Status, tactics, reminders…"
              className="mt-1 w-full resize-y rounded border border-surface-border bg-[#2c251f] px-3 py-2 text-ink scheme-dark placeholder:text-ink-muted/60"
              value={draft.comment}
              onChange={(e) =>
                setDraft((d) => ({ ...d, comment: e.target.value }))
              }
            />
          </label>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !draft.name.trim()}
              className={clsx(
                "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90",
                (saving || !draft.name.trim()) &&
                  "cursor-not-allowed opacity-50"
              )}
              onClick={() => onSubmit(draft)}
            >
              {saving ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
