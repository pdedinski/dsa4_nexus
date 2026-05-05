"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NoteRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export default function NotesList() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/notes");
    const data = await res.json();
    setNotes(data.notes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createNote() {
    setCreating(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New note" }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      alert(data.error ?? "Could not create note");
      return;
    }
    const id = data.note?.id as string | undefined;
    if (id) router.push(`/notes/${id}`);
    else void load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          type="button"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={creating}
          onClick={() => void createNote()}
        >
          {creating ? "Creating…" : "New note"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No notes yet. Create one to start writing — use{" "}
          <kbd className="rounded border border-surface-border px-1">@</kbd> to mention
          characters while editing.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notes/${n.id}`}
                className="block rounded-lg border border-surface-border bg-surface-card px-4 py-3 hover:border-brand-muted transition-colors"
              >
                <span className="font-medium text-ink">
                  {n.title?.trim() || "Untitled"}
                </span>
                <span className="block text-xs text-ink-faint mt-1">
                  Updated {new Date(n.updatedAt).toLocaleString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
