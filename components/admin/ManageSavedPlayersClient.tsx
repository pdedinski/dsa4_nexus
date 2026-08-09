"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { ChargenCatalogCategory, HeldModel } from "@/lib/chargen/types";
import ChargenSheetView from "@/components/chargen/ChargenSheetView";
import { downloadLegacyHeldXml } from "@/lib/chargen/io/exportLegacyXml";
import BodyPortal from "@/components/ui/BodyPortal";
import variantLabels from "@/lib/chargen/data/variant_labels.json";
import type { GroupedChargenCharacter } from "@/lib/chargen/heroesVersioning";

type VersionRow = GroupedChargenCharacter["versions"][number] & {
  characterName: string;
  characterId: string;
  /** Main (latest) row vs nested older version. */
  isLatestRow: boolean;
  versionCount: number;
};

function buildLabelMap(
  catalogs: Partial<Record<ChargenCatalogCategory, CatalogItem[]>>
): Record<string, string> {
  const m: Record<string, string> = {};
  const lists = [
    catalogs.races,
    catalogs.cultures,
    catalogs.professions,
    catalogs.talents,
    catalogs.spells,
    catalogs.advantages_disadvantages,
    catalogs.special_abilities,
    catalogs.melee_weapons,
    catalogs.ranged_weapons,
    catalogs.armor,
    catalogs.shields,
    variantLabels as Array<{ id: string; name?: string }>,
  ];
  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      m[item.id] = (item.name as string) || item.id;
    }
  }
  return m;
}

function formatUpdated(value?: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function ManageSavedPlayersClient() {
  const [heroes, setHeroes] = useState<GroupedChargenCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VersionRow | null>(null);
  const [viewHeld, setViewHeld] = useState<HeldModel | null>(null);
  const [viewBusyId, setViewBusyId] = useState<string | null>(null);
  const [exportBusyId, setExportBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [catalogs, setCatalogs] = useState<
    Partial<Record<ChargenCatalogCategory, CatalogItem[]>>
  >({});

  const labelMap = useMemo(() => buildLabelMap(catalogs), [catalogs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/manage/chargen-heroes");
      const data = (await res.json()) as {
        heroes?: GroupedChargenCharacter[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Failed to load saved players");
        setHeroes([]);
        return;
      }
      setHeroes(data.heroes ?? []);
    } catch {
      setError("Failed to load saved players");
      setHeroes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/chargen/catalog");
        const data = (await res.json()) as {
          catalogs?: Record<ChargenCatalogCategory, CatalogItem[]>;
        };
        if (!cancelled) setCatalogs(data.catalogs ?? {});
      } catch {
        /* labels fall back to ids */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewHeld && !confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViewHeld(null);
        setConfirmDelete(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewHeld, confirmDelete]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.ownerName && h.ownerName.toLowerCase().includes(q))
    );
  }, [heroes, search]);

  async function fetchHeroData(id: string): Promise<HeldModel | null> {
    const res = await fetch(`/api/chargen/heroes/${id}`);
    const data = (await res.json()) as {
      data?: HeldModel;
      error?: string;
    };
    if (!res.ok || !data.data) {
      setError(data.error || "Failed to load hero");
      return null;
    }
    return data.data;
  }

  async function viewSheet(row: { id: string }) {
    setViewBusyId(row.id);
    setError(null);
    try {
      const held = await fetchHeroData(row.id);
      if (held) setViewHeld(held);
    } finally {
      setViewBusyId(null);
    }
  }

  async function exportDcg(row: { id: string; name: string }) {
    setExportBusyId(row.id);
    setError(null);
    try {
      const held = await fetchHeroData(row.id);
      if (!held) return;
      const baseName = (held.name || row.name || "hero").replace(
        /[^\w\-]+/g,
        "_"
      );
      downloadLegacyHeldXml(held, `${baseName}.dcg`);
    } finally {
      setExportBusyId(null);
    }
  }

  async function deleteHero(
    row: VersionRow,
    mode: "latest" | "all" | "single"
  ) {
    setError(null);
    const qs = mode === "all" ? "?allVersions=1" : "";
    const res = await fetch(`/api/manage/chargen-heroes/${row.id}${qs}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConfirmDelete(null);
      void load();
    } else {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Failed to delete");
      setConfirmDelete(null);
    }
  }

  function ActionButtons({
    row,
  }: {
    row: {
      id: string;
      name: string;
      version: number;
      characterName: string;
      characterId: string;
      isLatestRow: boolean;
      versionCount: number;
    };
  }) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/tools/player-character-generator?heroId=${row.id}`}
          title="Edit in generator"
          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sidebar"
        >
          <Pencil className="w-4 h-4" />
        </Link>
        <button
          type="button"
          title="Export .dcg"
          disabled={exportBusyId === row.id}
          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sidebar disabled:opacity-40"
          onClick={() => void exportDcg(row)}
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Delete"
          className="p-1.5 rounded-md text-ink-muted hover:text-red-400 hover:bg-surface-sidebar"
          onClick={() =>
            setConfirmDelete({
              id: row.id,
              version: row.version,
              name: row.name,
              updatedAt: "",
              createdBy: null,
              ownerName: null,
              characterName: row.characterName,
              characterId: row.characterId,
              isLatestRow: row.isLatestRow,
              versionCount: row.versionCount,
            })
          }
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const sheetLabels = useMemo(() => {
    if (!viewHeld) {
      return { byId: labelMap };
    }
    return {
      race: labelMap[viewHeld.raceId],
      culture: labelMap[viewHeld.cultureId],
      profession: labelMap[viewHeld.professionId],
      byId: labelMap,
    };
  }, [viewHeld, labelMap]);

  return (
    <div className="space-y-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name or owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-card border border-surface-border text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-xl border border-surface-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-card border-b border-surface-border">
              <th className="w-10 px-2 py-3" />
              <th className="text-left px-4 py-3 text-ink-muted font-medium">
                Hero
              </th>
              <th className="text-left px-3 py-3 text-ink-muted font-medium">
                Owner
              </th>
              <th className="text-left px-3 py-3 text-ink-muted font-medium">
                Updated
              </th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-ink-muted py-8 px-4"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-ink-muted py-8 px-4"
                >
                  No saved players yet.
                </td>
              </tr>
            )}
            {filtered.map((h) => {
              const hasOlder = h.versions.length > 1;
              const isOpen = !!expanded[h.characterId];
              const older = [...h.versions].slice(0, -1).reverse();
              return (
                <Fragment key={h.characterId}>
                  <tr className="border-b border-surface-border hover:bg-surface-card/50 transition-colors">
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {hasOlder ? (
                          <button
                            type="button"
                            title={
                              isOpen
                                ? "Hide older versions"
                                : "Show older versions"
                            }
                            className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sidebar"
                            onClick={() =>
                              setExpanded((prev) => ({
                                ...prev,
                                [h.characterId]: !prev[h.characterId],
                              }))
                            }
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-6" />
                        )}
                        <button
                          type="button"
                          title="View character sheet"
                          disabled={viewBusyId === h.id}
                          className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sidebar disabled:opacity-40"
                          onClick={() => void viewSheet(h)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink font-medium">
                      <span>{h.name}</span>
                      <span className="ml-2 text-xs font-normal text-ink-faint">
                        v{h.version}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      {h.ownerName || "—"}
                    </td>
                    <td className="px-3 py-3 text-ink-muted whitespace-nowrap">
                      {formatUpdated(h.updatedAt)}
                    </td>
                    <td className="px-3 py-3">
                      <ActionButtons
                        row={{
                          id: h.id,
                          name: h.name,
                          version: h.version,
                          characterName: h.name,
                          characterId: h.characterId,
                          isLatestRow: true,
                          versionCount: h.versions.length,
                        }}
                      />
                    </td>
                  </tr>
                  {isOpen &&
                    older.map((v) => (
                      <tr
                        key={v.id}
                        className="border-b border-surface-border bg-surface-card/30 text-ink-muted"
                      >
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            title="View character sheet"
                            disabled={viewBusyId === v.id}
                            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sidebar disabled:opacity-40"
                            onClick={() => void viewSheet(v)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                        <td className="px-4 py-2 pl-10">
                          <span className="text-ink-muted">{v.name}</span>
                          <span className="ml-2 text-xs text-ink-faint">
                            v{v.version}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {v.ownerName || h.ownerName || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatUpdated(v.updatedAt)}
                        </td>
                        <td className="px-3 py-2">
                          <ActionButtons
                            row={{
                              id: v.id,
                              name: v.name,
                              version: v.version,
                              characterName: h.name,
                              characterId: h.characterId,
                              isLatestRow: false,
                              versionCount: h.versions.length,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewHeld && (
        <BodyPortal>
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
            <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-surface-border bg-[#1a1410] shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-3 shrink-0">
                <h2 className="text-lg font-bold text-ink truncate">
                  {viewHeld.name || "Unnamed Hero"}
                </h2>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sidebar"
                  onClick={() => setViewHeld(null)}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-4">
                <ChargenSheetView held={viewHeld} labels={sheetLabels} />
              </div>
            </div>
          </div>
        </BodyPortal>
      )}

      {confirmDelete && (
        <BodyPortal>
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
              {confirmDelete.isLatestRow ? (
                <>
                  <h3 className="text-base font-bold text-ink mb-2">
                    Delete character?
                  </h3>
                  <p className="text-sm text-ink-muted mb-4">
                    <span className="text-ink font-medium">
                      {confirmDelete.characterName}
                    </span>{" "}
                    has{" "}
                    {confirmDelete.versionCount === 1
                      ? "1 version"
                      : `${confirmDelete.versionCount} versions`}
                    . Choose what to remove. This cannot be undone.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-sm bg-red-800 text-white font-medium hover:bg-red-700"
                      onClick={() => void deleteHero(confirmDelete, "all")}
                    >
                      Delete all versions
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-sm border border-red-800/60 text-red-300 hover:bg-red-900/30 font-medium"
                      onClick={() => void deleteHero(confirmDelete, "latest")}
                    >
                      Delete latest version
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-ink mb-2">
                    Delete version?
                  </h3>
                  <p className="text-sm text-ink-muted mb-4">
                    Permanently delete version {confirmDelete.version} of{" "}
                    <span className="text-ink font-medium">
                      {confirmDelete.characterName}
                    </span>{" "}
                    from the shared chargen library. This cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={clsx(
                        "px-3 py-2 rounded-lg text-sm bg-red-800 text-white font-medium hover:bg-red-700"
                      )}
                      onClick={() => void deleteHero(confirmDelete, "single")}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </BodyPortal>
      )}
    </div>
  );
}
