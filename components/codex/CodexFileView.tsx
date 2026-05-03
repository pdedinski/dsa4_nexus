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

function beastListPreview(payload: Record<string, unknown>): string | null {
  const raw = String(payload.description ?? "").replace(/\s+/g, " ").trim();
  const desc =
    raw.length > 130 ? `${raw.slice(0, 127).trim()}…` : raw;
  const grp = String(payload.parent_group_name ?? "").trim();
  const bits = [grp ? grp : "", desc ? desc : ""].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

/** Collapse creatures by book category (`parent_group_name`). */
function buildBestiaryCategorySections(
  listing: ResolvedEntry[],
): { sectionKey: string; label: string; entries: ResolvedEntry[] }[] {
  const map = new Map<string, ResolvedEntry[]>();
  for (const entry of listing) {
    const p = entry.payload;
    if (p.is_group_entry === true) continue;
    const cn = String(p.parent_group_name ?? "").trim();
    const key = cn || "_uncategorized";
    const label = cn || "Uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  function sortInside(list: ResolvedEntry[]) {
    return [...list].sort((a, b) =>
      String(a.payload.name ?? a.id).localeCompare(
        String(b.payload.name ?? b.id),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }

  const out = [...map.entries()].map(([sectionKey, entries]) => ({
    sectionKey,
    label: sectionKey === "_uncategorized" ? "Uncategorized" : sectionKey,
    entries: sortInside(entries),
  }));

  out.sort((a, b) => {
    if (a.sectionKey === "_uncategorized") return 1;
    if (b.sectionKey === "_uncategorized") return -1;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  return out;
}

const SUMMON_KIND_LABELS: Record<string, string> = {
  elemental: "Elementals",
  spirit: "Spirits",
  golem: "Golems",
  demon: "Demons",
  undead: "Undead",
  chimera_or_daimonid: "Chimeras / daimonids",
};

const SUMMON_CATEGORY_ORDER = [
  "elemental",
  "spirit",
  "golem",
  "demon",
  "undead",
  "chimera_or_daimonid",
];

function summonedKindLabel(cat: unknown): string {
  const k = String(cat ?? "").trim();
  return (SUMMON_KIND_LABELS[k] ?? k.replace(/_/g, " ")) || "Other";
}

function summonedListPreview(payload: Record<string, unknown>): string | null {
  const raw = String(payload.description ?? "").replace(/\s+/g, " ").trim();
  const desc =
    raw.length > 120 ? `${raw.slice(0, 117).trim()}…` : raw;
  const kind = summonedKindLabel(payload.category);
  const bits = [kind !== "Other" ? kind : "", desc].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

/** Group summoned beings by WDZ creature kind (`category` field). */
function buildSummonedKindSections(
  listing: ResolvedEntry[],
): { sectionKey: string; label: string; entries: ResolvedEntry[] }[] {
  const map = new Map<string, ResolvedEntry[]>();
  for (const entry of listing) {
    const ck = String(entry.payload.category ?? "").trim() || "_misc";
    if (!map.has(ck)) map.set(ck, []);
    map.get(ck)!.push(entry);
  }

  function sortInside(list: ResolvedEntry[]) {
    return [...list].sort((a, b) =>
      String(a.payload.name ?? a.id).localeCompare(
        String(b.payload.name ?? b.id),
        undefined,
        { sensitivity: "base" },
      ),
    );
  }

  const out = [...map.entries()].map(([sectionKey, ent]) => ({
    sectionKey,
    label:
      sectionKey === "_misc"
        ? "Miscellaneous"
        : summonedKindLabel(sectionKey),
    entries: sortInside(ent),
  }));

  function orderRank(sectionKey: string): number {
    if (sectionKey === "_misc") return 999;
    const i = SUMMON_CATEGORY_ORDER.indexOf(sectionKey);
    if (i >= 0) return i;
    return 50;
  }

  out.sort((a, b) => {
    const ra = orderRank(a.sectionKey);
    const rb = orderRank(b.sectionKey);
    if (ra !== rb) return ra - rb;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
  return out;
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
  /** Full codex JSON (summoned beings resolve common_rules_ref from meta). */
  codexRaw?: Record<string, unknown>;
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
  codexRaw,
}: CodexEntryCardProps) {
  const isOpen = expanded.has(entry.id);
  const name = (entry.payload.name as string | undefined) ?? entry.id;
  const germanName = entry.payload.german_name as string | undefined;
  const spellPreview =
    category === "magic" && fileKey === "spells"
      ? spellListPreview(entry.payload as Record<string, unknown>)
      : null;
  const beastPreview =
    category === "bestiary" && fileKey === "beasts"
      ? beastListPreview(entry.payload as Record<string, unknown>)
      : null;
  const summonedPreview =
    category === "bestiary" && fileKey === "summoned_creatures"
      ? summonedListPreview(entry.payload as Record<string, unknown>)
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
          {category === "bestiary" &&
            (fileKey === "beasts" || fileKey === "summoned_creatures") &&
            entry.payload.needs_data_review === true && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-200/95 border border-amber-900/60 shrink-0">
                Review stats
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

      {!isOpen && beastPreview && (
        <p className="px-4 pb-3 pl-11 text-xs text-ink-muted leading-snug line-clamp-3">
          {beastPreview}
        </p>
      )}

      {!isOpen && summonedPreview && (
        <p className="px-4 pb-3 pl-11 text-xs text-ink-muted leading-snug line-clamp-3">
          {summonedPreview}
        </p>
      )}

      {isOpen && (
        <div className="border-t border-surface-border px-4 pb-4 pt-3">
          <EntryDetail
            payload={entry.payload}
            category={category}
            fileKey={fileKey}
            codexRaw={
              category === "bestiary" && fileKey === "summoned_creatures"
                ? codexRaw
                : undefined
            }
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
      const beastCategory =
        category === "bestiary" && fileKey === "beasts"
          ? String(e.payload.parent_group_name ?? "").toLowerCase()
          : "";
      const summonKindHint =
        category === "bestiary" && fileKey === "summoned_creatures"
          ? summonedKindLabel(e.payload.category).toLowerCase()
          : "";
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
        beastCategory.includes(q) ||
        summonKindHint.includes(q) ||
        talent.includes(q)
      );
    });
  }, [entries, search, fileKey, category]);

  /** Creatures listed in the codex (no book-only group header rows). */
  const filteredCreaturesOnly = useMemo(() => {
    if (category !== "bestiary" || fileKey !== "beasts") return filtered;
    return filtered.filter((e) => e.payload.is_group_entry !== true);
  }, [category, fileKey, filtered]);

  const bestiaryCategorySections = useMemo(() => {
    if (category !== "bestiary" || fileKey !== "beasts") return null;
    return buildBestiaryCategorySections(filteredCreaturesOnly);
  }, [category, fileKey, filteredCreaturesOnly]);

  const summonedKindSections = useMemo(() => {
    if (category !== "bestiary" || fileKey !== "summoned_creatures")
      return null;
    return buildSummonedKindSections(filtered);
  }, [category, fileKey, filtered]);

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

  const [bestiarySectionsClosed, setBestiarySectionsClosed] = useState<
    Set<string>
  >(new Set());

  function toggleBestiarySection(sectionKey: string) {
    setBestiarySectionsClosed((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }

  const [summonedSectionsClosed, setSummonedSectionsClosed] = useState<
    Set<string>
  >(new Set());

  function toggleSummonedSection(sectionKey: string) {
    setSummonedSectionsClosed((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  }

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
      <div className="p-4 md:p-6 max-w-4xl">
        <PageHeader label={label} search={search} onSearch={setSearch} />
        <RawDataView raw={resolved.raw} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <PageHeader label={label} search={search} onSearch={setSearch} />

      <p className="text-ink-muted text-xs mb-4">
        {category === "bestiary" && fileKey === "beasts"
          ? `${filteredCreaturesOnly.length} / ${entries.length} creatures`
          : category === "bestiary" && fileKey === "summoned_creatures"
            ? `${filtered.length} / ${entries.length} summoned beings`
            : `${filtered.length} / ${entries.length} entries`}
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
                          codexRaw={resolved.raw}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          : bestiaryCategorySections
          ? bestiaryCategorySections.map(
              ({ sectionKey, label, entries: groupEntries }) => {
                const sectionOpen = !bestiarySectionsClosed.has(sectionKey);
                return (
                  <div
                    key={sectionKey}
                    className="rounded-lg border border-surface-border bg-surface-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleBestiarySection(sectionKey)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-surface-border/40 hover:bg-surface-border/70 transition-colors"
                    >
                      {sectionOpen ? (
                        <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                      )}
                      <span className="text-ink font-semibold text-sm">
                        {label}
                      </span>
                      <span className="text-ink-muted text-xs tabular-nums">
                        ({groupEntries.length})
                      </span>
                    </button>
                    {sectionOpen && (
                      <div className="border-t border-surface-border space-y-1 px-2 pb-2 pt-1 bg-surface-card/80">
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
                            codexRaw={resolved.raw}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            )
          : summonedKindSections
          ? summonedKindSections.map(
              ({ sectionKey, label, entries: groupEntries }) => {
                const sectionOpen = !summonedSectionsClosed.has(sectionKey);
                return (
                  <div
                    key={sectionKey}
                    className="rounded-lg border border-surface-border bg-surface-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSummonedSection(sectionKey)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-left bg-surface-border/40 hover:bg-surface-border/70 transition-colors"
                    >
                      {sectionOpen ? (
                        <ChevronDown className="w-4 h-4 text-ink-muted shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                      )}
                      <span className="text-ink font-semibold text-sm">
                        {label}
                      </span>
                      <span className="text-ink-muted text-xs tabular-nums">
                        ({groupEntries.length})
                      </span>
                    </button>
                    {sectionOpen && (
                      <div className="border-t border-surface-border space-y-1 px-2 pb-2 pt-1 bg-surface-card/80">
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
                            codexRaw={resolved.raw}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            )
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
                codexRaw={resolved.raw}
              />
            ))}

        {((summonedKindSections != null
          ? filtered.length === 0
          : bestiaryCategorySections != null
            ? filteredCreaturesOnly.length === 0
            : filtered.length === 0)) && (
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
