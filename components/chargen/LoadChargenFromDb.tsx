"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import type { GroupedChargenCharacter } from "@/lib/chargen/heroesVersioning";

export type DbHeroLoadPayload = {
  id: string;
  characterId: string;
  version: number;
  updatedAt: string | null;
  data: unknown;
  createdBy: string | null;
};

function formatVersionLabel(
  version: number,
  updatedAt?: string | Date | null
): string {
  const when = updatedAt
    ? new Date(updatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;
  return when ? `v${version} — ${when}` : `v${version}`;
}

export default function LoadChargenFromDb({
  onLoad,
}: {
  onLoad: (hero: DbHeroLoadPayload) => void;
}) {
  const [heroes, setHeroes] = useState<GroupedChargenCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    null
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chargen/heroes");
      const data = (await res.json()) as {
        heroes?: GroupedChargenCharacter[];
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

  const selected = heroes.find((h) => h.characterId === selectedCharacterId) ?? null;

  useEffect(() => {
    if (!selected) {
      setSelectedVersionId(null);
      return;
    }
    const latest = selected.versions[selected.versions.length - 1];
    setSelectedVersionId(latest?.id ?? selected.id);
  }, [selected]);

  async function handleLoad() {
    if (!selectedVersionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/chargen/heroes/${selectedVersionId}`);
      const data = (await res.json()) as {
        id?: string;
        characterId?: string;
        version?: number;
        updatedAt?: string;
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
        characterId: data.characterId ?? selected?.characterId ?? data.id,
        version: data.version ?? 1,
        updatedAt: data.updatedAt ?? null,
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
                <li key={h.characterId}>
                  <button
                    type="button"
                    className={clsx(
                      "w-full px-3 py-2 text-left text-sm hover:bg-surface-sidebar",
                      selectedCharacterId === h.characterId && "bg-brand-muted"
                    )}
                    onClick={() => {
                      setSelectedCharacterId(h.characterId);
                      setOpen(false);
                    }}
                  >
                    <span className="text-ink block truncate">{h.name}</span>
                    <span className="text-ink-faint text-xs">
                      {h.ownerName ? `${h.ownerName} · ` : ""}
                      {formatVersionLabel(h.version, h.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {selected && (
        <select
          className="px-3 py-2 rounded-lg border border-surface-border bg-[#2c251f] text-sm text-ink scheme-dark min-w-[12rem]"
          value={selectedVersionId ?? ""}
          onChange={(e) => setSelectedVersionId(e.target.value || null)}
          aria-label="Character version"
        >
          {[...selected.versions].reverse().map((v) => (
            <option key={v.id} value={v.id}>
              {formatVersionLabel(v.version, v.updatedAt)}
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        disabled={!selectedVersionId || busy}
        className="px-4 py-2 rounded-lg border border-surface-border text-sm text-ink disabled:opacity-40"
        onClick={() => void handleLoad()}
      >
        {busy ? "Loading…" : "Load from DB"}
      </button>
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </div>
  );
}
