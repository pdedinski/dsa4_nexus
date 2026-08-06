"use client";

import { useRef, useState } from "react";
import BodyPortal from "@/components/ui/BodyPortal";
import { importHeldJson } from "@/lib/chargen/io/importJson";
import {
  importLegacyHeldXml,
  isLegacyHeldXml,
} from "@/lib/chargen/io/importLegacyXml";
import type { HeldModel } from "@/lib/chargen/types";

function isLegacyChargenFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".dcg") || lower.endsWith(".xml");
}

export default function ImportChargenDialog({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (held: HeldModel) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      let held: HeldModel;
      if (isLegacyHeldXml(text) || isLegacyChargenFile(file.name)) {
        held = importLegacyHeldXml(text);
      } else {
        held = importHeldJson(text);
      }
      onImport(held);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-md rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
          <h2 className="text-lg font-bold text-ink mb-2">Import character</h2>
          <p className="text-sm text-ink-muted mb-4">
            Upload a Java Chargen{" "}
            <code className="text-xs">.dcg</code> file (default), or a{" "}
            <code className="text-xs">.xml</code> / Nexus JSON export.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".dcg,.xml,.json,application/xml,text/xml,application/json"
            className="block w-full text-sm text-ink"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {error && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
