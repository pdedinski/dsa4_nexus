"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";

export interface DbHeroListItem {
  id: string;
  name: string;
  updatedAt?: string;
  createdBy?: string | null;
  ownerName?: string | null;
}

export default function LoadChargenFromDb({
  onLoad,
}: {
  onLoad: (hero: {
    id: string;
    data: unknown;
    createdBy: string | null;
  }) => void;
}) {
  const [heroes, setHeroes] = useState<DbHeroListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chargen/heroes");
      const data = (await res.json()) as {
        heroes?: DbHeroListItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to load heroes");
        setHeroes([]);
        return;
      }
      setHeroes(data.heroes ?? []);
    } catch {
      setError("Failed to load heroes");
      setHeroes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.ownerName && h.ownerName.toLowerCase().includes(q))
    );
  }, [heroes, query]);

  const selected = heroes.find((h) => h.id === selectedId) ?? null;

  async function handleLoad() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chargen/heroes/${selectedId}`);
      const data = (await res.json()) as {
        id?: string;
        data?: unknown;
        createdBy?: string | null;
        error?: string;
      };
      if (!res.ok || !data.id || !data.data) {
        setError(data.error || "Failed to load hero");
        return;
      }
      onLoad({
        id: data.id,
        data: data.data,
        createdBy: data.createdBy ?? null,
      });
      setOpen(false);
    } catch {
      setError("Failed to load hero");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="relative min-w-[14rem] flex-1 max-w-sm">
        <button
          type="button"
          className="w-full px-3 py-2 rounded-lg border border-surface-border bg-[#2c251f] text-sm text-left text-ink scheme-dark"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void loadList();
          }}
        >
          {selected ? selected.name : "Select saved hero…"}
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-full rounded-lg border border-surface-border bg-[#1a1410] shadow-2xl overflow-hidden">
            <input
              type="search"
              autoFocus
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#2c251f] border-b border-surface-border text-ink placeholder:text-ink-faint outline-none"
            />
            <ul className="max-h-56 overflow-y-auto py-1">
              {loading && (
                <li className="px-3 py-2 text-sm text-ink-muted">Loading…</li>
              )}
              {!loading && filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-muted">
                  No saved heroes
                </li>
              )}
              {filtered.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className={clsx(
                      "w-full px-3 py-2 text-left text-sm hover:bg-surface-sidebar",
                      selectedId === h.id && "bg-brand-muted"
                    )}
                    onClick={() => {
                      setSelectedId(h.id);
                      setOpen(false);
                    }}
                  >
                    <span className="text-ink block truncate">{h.name}</span>
                    {h.ownerName && (
                      <span className="text-ink-faint text-xs">
                        {h.ownerName}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={!selectedId || busy}
        className="px-4 py-2 rounded-lg border border-surface-border text-sm text-ink disabled:opacity-40"
        onClick={() => void handleLoad()}
      >
        {busy ? "Loading…" : "Load from DB"}
      </button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </div>
  );
}
