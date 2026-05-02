"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronRight, Edit2, History } from "lucide-react";
import type { ResolvedFile, ResolvedEntry } from "@/lib/codex/resolver";
import EntryDetail from "./EntryDetail";
import VersionModal from "./VersionModal";
import EditModal from "./EditModal";

function combatTalentSectionLabel(talentKey: string): string {
  if (talentKey === "_other") return "Other";
  return talentKey.replace(/_/g, " ");
}

/** One-line preview for spell list rows (collapsed). */
function spellListPreview(payload: Record<string, unknown>): string | null {
  const test = Array.isArray(payload.test_attributes)
    ? (payload.test_attributes as string[]).join(" / ")
    : "";
  const target = String(payload.target ?? "").trim();
  const raw = String(payload.description ?? "").replace(/\s+/g, " ").trim();
  const desc =
    raw.length > 160 ? `${raw.slice(0, 157).trim()}…` : raw;
  const bits = [
    test ? `Test ${test}` : "",
    target ? `Target ${target}` : "",
    desc ? desc : "",
  ].filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : null;
}

interface CodexEntryCardProps {
  entry: ResolvedEntry;
  category: string;
  fileKey: string;
  expanded: Set<string>;
  onToggleEntry: (id: string) => void;
  isEditor: boolean;
  sourceId: string | undefined;
  onOpenVersions: (v: { id: string; payload: Record<string, unknown> }) => void;
  onOpenEdit: (v: { id: string; payload: Record<string, unknown> }) => void;
}

function CodexEntryCard({
  entry,
  category,
  fileKey,
  expanded,
  onToggleEntry,
  isEditor,
  sourceId,
  onOpenVersions,
  onOpenEdit,
}: CodexEntryCardProps) {
  const isOpen = expanded.has(entry.id);
  const name = (entry.payload.name as string | undefined) ?? entry.id;
  const germanName = entry.payload.german_name as string | undefined;
  const spellPreview =
    category === "magic" && fileKey === "spells"
      ? spellListPreview(entry.payload as Record<string, unknown>)
      : null;

  return (
    <div className="rounded-lg border border-surface-border bg-surface-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => onToggleEntry(entry.id)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
          )}
          <span className="text-ink font-medium text-sm truncate">{name}</span>
          {germanName && germanName !== name && (
            <span className="text-ink-muted text-xs shrink-0">
              ({germanName})
            </span>
          )}
          {entry.dbVersionId && (
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-brand-muted text-brand-light border border-brand shrink-0">
              {entry.versionLabel ?? "custom"}
            </span>
          )}
        </button>

        {isEditor && sourceId && (
          <div className="flex items-center gap-1 shrink-0">
            {entry.hasDbVersions && (
              <button
                type="button"
                onClick={() =>
                  onOpenVersions({ id: entry.id, payload: entry.payload })
                }
                title="Versions"
                className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-surface-border transition-colors"
              >
                <History className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                onOpenEdit({ id: entry.id, payload: entry.payload })
              }
              title="Edit"
              className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-surface-border transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {!isOpen && spellPreview && (
        <p className="px-4 pb-3 pl-11 text-xs text-ink-muted leading-snug line-clamp-3">
          {spellPreview}
        </p>
      )}

      {isOpen && (
        <div className="border-t border-surface-border px-4 pb-4 pt-3">
          <EntryDetail
            payload={entry.payload}
            category={category}
            fileKey={fileKey}
          />
        </div>
      )}
    </div>
  );
}

interface Props {
  category: string;
  fileKey: string;
  label: string;
  resolved: ResolvedFile;
  isEditor: boolean;
  sourceId: string | undefined;
}

export default function CodexFileView({
  category,
  fileKey,
  label,
  resolved,
  isEditor,
  sourceId,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [versionEntry, setVersionEntry] = useState<{
    id: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const [editEntry, setEditEntry] = useState<{
    id: string;
    payload: Record<string, unknown>;
  } | null>(null);

  const entries = resolved.entries;

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const name =
        String(e.payload.name ?? e.payload.id ?? "").toLowerCase();
      const german = String(e.payload.german_name ?? "").toLowerCase();
      const desc = String(e.payload.description ?? "").toLowerCase();
      const talent =
        fileKey === "weapons"
          ? String(e.payload.combat_talent ?? "")
              .toLowerCase()
              .replace(/_/g, " ")
          : "";
      return (
        name.includes(q) ||
        german.includes(q) ||
        desc.includes(q) ||
        talent.includes(q)
      );
    });
  }, [entries, search, fileKey]);

  const weaponTalentGroups = useMemo(() => {
    if (fileKey !== "weapons" || category !== "equipment") return null;
    const map = new Map<string, ResolvedEntry[]>();
    for (const e of filtered) {
      const raw = e.payload.combat_talent;
      const key =
        raw != null && String(raw).trim() !== ""
          ? String(raw).trim()
          : "_other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const keys = [...map.keys()].sort((a, b) =>
      combatTalentSectionLabel(a).localeCompare(
        combatTalentSectionLabel(b),
        undefined,
        { sensitivity: "base" }
      )
    );
    return keys.map((talentKey) => {
      const groupEntries = map.get(talentKey)!;
      groupEntries.sort((a, b) =>
        String(a.payload.name ?? a.id).localeCompare(
          String(b.payload.name ?? b.id),
          undefined,
          { sensitivity: "base" }
        )
      );
      return { talentKey, entries: groupEntries };
    });
  }, [fileKey, category, filtered]);

  const [weaponSectionsClosed, setWeaponSectionsClosed] = useState<
    Set<string>
  >(new Set());

  function toggleWeaponSection(talentKey: string) {
    setWeaponSectionsClosed((prev) => {
      const next = new Set(prev);
      if (next.has(talentKey)) next.delete(talentKey);
      else next.add(talentKey);
      return next;
    });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // For advancement_costs (raw-only file)
  if (fileKey === "advancement_costs") {
    return (
      <div className="p-6 max-w-4xl">
        <PageHeader label={label} search={search} onSearch={setSearch} />
        <RawDataView raw={resolved.raw} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader label={label} search={search} onSearch={setSearch} />

      <p className="text-ink-muted text-xs mb-4">
        {filtered.length} / {entries.length} entries
      </p>

      <div className="space-y-1">
        {weaponTalentGroups
          ? weaponTalentGroups.map(({ talentKey, entries: groupEntries }) => {
              const sectionOpen = !weaponSectionsClosed.has(talentKey);
              return (
                <div
                  key={talentKey}
                  className="rounded-lg border border-[#4a3d34] border-l-4 border-l-[#ff5a4a] bg-[#0c0a08] shadow-md shadow-black/40 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleWeaponSection(talentKey)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-[#2c1c19] hover:bg-[#3d2824] transition-colors"
                  >
                    {sectionOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#ffb4a8] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#ffb4a8] shrink-0" />
                    )}
                    <span className="text-[#ffeae6] font-bold text-sm capitalize tracking-tight drop-shadow-sm">
                      {combatTalentSectionLabel(talentKey)}
                    </span>
                    <span className="text-[#e8a090] text-xs font-semibold tabular-nums">
                      ({groupEntries.length})
                    </span>
                  </button>
                  {sectionOpen && (
                    <div className="border-t border-[#3a2e26] bg-[#100d0a] space-y-1 px-2 pb-2 pt-1">
                      {groupEntries.map((entry) => (
                        <CodexEntryCard
                          key={entry.id}
                          entry={entry}
                          category={category}
                          fileKey={fileKey}
                          expanded={expanded}
                          onToggleEntry={toggle}
                          isEditor={isEditor}
                          sourceId={sourceId}
                          onOpenVersions={setVersionEntry}
                          onOpenEdit={setEditEntry}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          : filtered.map((entry) => (
              <CodexEntryCard
                key={entry.id}
                entry={entry}
                category={category}
                fileKey={fileKey}
                expanded={expanded}
                onToggleEntry={toggle}
                isEditor={isEditor}
                sourceId={sourceId}
                onOpenVersions={setVersionEntry}
                onOpenEdit={setEditEntry}
              />
            ))}

        {filtered.length === 0 && (
          <p className="text-ink-muted text-sm py-8 text-center">
            No entries match &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

      {versionEntry && sourceId && (
        <VersionModal
          sourceId={sourceId}
          entryId={versionEntry.id}
          isEditor={isEditor}
          onClose={() => setVersionEntry(null)}
          onVersionsMutated={() => router.refresh()}
        />
      )}

      {editEntry && sourceId && (
        <EditModal
          sourceId={sourceId}
          category={category}
          fileKey={fileKey}
          entryId={editEntry.id}
          initialPayload={editEntry.payload}
          onClose={() => setEditEntry(null)}
          onSaved={() => {
            setEditEntry(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function PageHeader({
  label,
  search,
  onSearch,
}: {
  label: string;
  search: string;
  onSearch: (v: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <h1 className="text-2xl font-bold text-ink flex-1">{label}</h1>
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-card border border-surface-border text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-brand transition-colors"
        />
      </div>
    </div>
  );
}

function RawDataView({ raw }: { raw: Record<string, unknown> }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const keys = Object.keys(raw).filter((k) => k !== "meta");

  return (
    <div className="space-y-2">
      {keys.map((key) => (
        <div
          key={key}
          className="rounded-lg border border-surface-border bg-surface-card overflow-hidden"
        >
          <button
            onClick={() =>
              setOpen((prev) => {
                const next = new Set(prev);
                next.has(key) ? next.delete(key) : next.add(key);
                return next;
              })
            }
            className="w-full flex items-center gap-2 px-4 py-3 text-left"
          >
            {open.has(key) ? (
              <ChevronDown className="w-4 h-4 text-ink-muted" />
            ) : (
              <ChevronRight className="w-4 h-4 text-ink-muted" />
            )}
            <span className="text-ink font-medium text-sm capitalize">
              {key.replace(/_/g, " ")}
            </span>
          </button>
          {open.has(key) && (
            <div className="border-t border-surface-border px-4 py-3">
              <pre className="text-xs text-ink-muted overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(raw[key], null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
