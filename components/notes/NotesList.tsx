"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NoteRow = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type SortBy = "updatedAt" | "createdAt" | "title";
type SortDir = "desc" | "asc";

export default function NotesList() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedNotes = useMemo(() => {
    const copy = [...notes];
    const cmpNum = (a: number, b: number) =>
      sortDir === "desc" ? b - a : a - b;
    copy.sort((a, b) => {
      if (sortBy === "title") {
        const ta = (a.title?.trim() || "Untitled").toLocaleLowerCase();
        const tb = (b.title?.trim() || "Untitled").toLocaleLowerCase();
        const c = ta.localeCompare(tb);
        return sortDir === "desc" ? -c : c;
      }
      const ta =
        sortBy === "createdAt"
          ? new Date(a.createdAt).getTime()
          : new Date(a.updatedAt).getTime();
      const tb =
        sortBy === "createdAt"
          ? new Date(b.createdAt).getTime()
          : new Date(b.updatedAt).getTime();
      return cmpNum(ta, tb);
    });
    return copy;
  }, [notes, sortBy, sortDir]);

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          type="button"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={creating}
          onClick={() => void createNote()}
        >
          {creating ? "Creating…" : "New note"}
        </button>

        {!loading && notes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="notes-sort-by">
              Sort notes by
            </label>
            <select
              id="notes-sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-surface-border bg-[#110e0a] px-2 py-1.5 text-sm text-ink"
            >
              <option value="updatedAt">Last updated</option>
              <option value="createdAt">Created</option>
              <option value="title">Name</option>
            </select>
            <label className="sr-only" htmlFor="notes-sort-dir">
              Sort direction
            </label>
            <select
              id="notes-sort-dir"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as SortDir)}
              className="rounded-lg border border-surface-border bg-[#110e0a] px-2 py-1.5 text-sm text-ink"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No notes yet. Create one to start writing — use{" "}
          <kbd className="rounded border border-surface-border px-1">@</kbd> to mention
          characters, <kbd className="rounded border border-surface-border px-1">#</kbd>{" "}
          to link other notes, and <kbd className="rounded border border-surface-border px-1">^</kbd>{" "}
          to link uploaded images while editing.
        </p>
      ) : (
        <ul className="space-y-2">
          {sortedNotes.map((n) => (
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
