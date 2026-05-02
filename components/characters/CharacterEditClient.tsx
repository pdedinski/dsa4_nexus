"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CharacterSheet } from "@/lib/character/types";

export default function CharacterEditClient({ characterId }: { characterId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sheetJson, setSheetJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/characters/${encodeURIComponent(characterId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.sheet) throw new Error(d.error ?? "Load failed");
        setName(d.name ?? "");
        setSheetJson(JSON.stringify(d.sheet, null, 2));
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
