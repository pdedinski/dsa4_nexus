"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import CodexModalPortal from "./CodexModalPortal";

interface Props {
  sourceId: string;
  category: string;
  fileKey: string;
  entryId: string;
  initialPayload: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditModal({
  sourceId,
  category,
  fileKey,
  entryId,
  initialPayload,
  onClose,
  onSaved,
}: Props) {
  const [json, setJson] = useState(
    JSON.stringify(initialPayload, null, 2)
  );
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError("Invalid JSON — please fix before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/codex/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceId,
        entryId,
        payload: parsed,
        versionLabel: label || undefined,
        setDefault: true,
      }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save.");
    }
  }

  return (
    <CodexModalPortal>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-3 py-4 md:p-4 bg-[#050403]/90 backdrop-blur-sm"
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="codex-edit-title"
          className="w-full max-w-2xl flex flex-col max-h-[90vh] rounded-xl border border-[#3a2e26] bg-[#231c16] shadow-2xl ring-1 ring-black/50"
        >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3a2e26] shrink-0 bg-[#231c16] rounded-t-xl">
          <div>
            <h2
              id="codex-edit-title"
              className="text-ink font-semibold text-sm"
            >
              Edit — {entryId}
            </h2>
            <p className="text-ink-muted text-xs mt-0.5">
              {category} / {fileKey}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version label */}
        <div className="px-5 pt-4 shrink-0 bg-[#231c16]">
          <input
            type="text"
            placeholder="Version label (optional, e.g. 'houserule v1')"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#1a1410] border border-[#3a2e26] text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {/* JSON editor */}
        <div className="flex-1 overflow-auto px-5 pt-3 pb-1 bg-[#231c16] min-h-0">
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            className="w-full h-full min-h-64 font-mono text-xs bg-[#1a1410] text-ink border border-[#3a2e26] rounded-lg p-3 resize-none focus:outline-none focus:border-brand transition-colors"
          />
        </div>

        {error && (
          <p className="px-5 py-1 text-xs text-red-400 shrink-0 bg-[#231c16]">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#3a2e26] shrink-0 bg-[#231c16] rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-muted hover:text-ink hover:bg-surface-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-brand hover:bg-brand-dark text-white transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save version"}
          </button>
        </div>
        </div>
      </div>
    </CodexModalPortal>
  );
}
