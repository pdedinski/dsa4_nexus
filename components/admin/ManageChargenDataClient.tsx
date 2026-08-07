"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHARGEN_CATALOG_CATEGORIES,
  type ChargenCatalogCategory,
} from "@/lib/chargen/types";
import BodyPortal from "@/components/ui/BodyPortal";
import {
  CHARBUILDER_XML_CATEGORIES,
  detectCharbuilderXmlCategory,
  downloadCharbuilderXml,
  parseCharbuilderXml,
  type CharbuilderXmlCategory,
} from "@/lib/chargen/io/charbuilderXml";
import {
  CHARBUILDER_BAUSTEIN_CATEGORIES,
  charbuilderBausteinAccept,
  charbuilderBausteinFilename,
  detectCharbuilderBausteinCategory,
  downloadBausteinXml,
  parseCharbuilderBausteinXml,
  serializeCharbuilderBausteinXml,
  type CharbuilderBausteinCategory,
} from "@/lib/chargen/io/charbuilderBausteineXml";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import { zipSync, strToU8 } from "fflate";

type DbRow = {
  id: string;
  entityId: string;
  data: Record<string, unknown>;
  notes: string | null;
};

const CATEGORY_LABELS: Record<ChargenCatalogCategory, string> = {
  races: "Races",
  cultures: "Cultures",
  professions: "Professions",
  melee_weapons: "Melee weapons",
  ranged_weapons: "Ranged weapons",
  armor: "Armor",
  shields: "Shields",
  talents: "Talents",
  spells: "Spells",
  advantages_disadvantages: "Advantages / Disadvantages",
  special_abilities: "Special abilities",
};

export default function ManageChargenDataClient() {
  const [category, setCategory] =
    useState<ChargenCatalogCategory>("races");
  const [items, setItems] = useState<DbRow[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DbRow | null>(null);
  const [entityId, setEntityId] = useState("");
  const [jsonText, setJsonText] = useState("{\n  \"name\": \"\"\n}");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DbRow | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteAllBusy, setDeleteAllBusy] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [xmlBusy, setXmlBusy] = useState(false);
  const [xmlMessage, setXmlMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setWarning(null);
    try {
      const res = await fetch(`/api/manage/chargen-data/${category}`);
      const data = (await res.json()) as {
        items?: DbRow[];
        warning?: string;
      };
      setItems(data.items ?? []);
      if (data.warning) setWarning(data.warning);
    } catch {
      setWarning("Failed to load chargen_data entries.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setEntityId("");
    setJsonText('{\n  "name": "",\n  "german_name": ""\n}');
    setNotes("");
    setError(null);
    setEditorOpen(true);
  }

  function openEdit(row: DbRow) {
    setEditing(row);
    setEntityId(row.entityId);
    setJsonText(JSON.stringify(row.data ?? {}, null, 2));
    setNotes(row.notes ?? "");
    setError(null);
    setEditorOpen(true);
  }

  async function save() {
    setError(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonText) as Record<string, unknown>;
    } catch {
      setError("Data must be valid JSON.");
      return;
    }
    if (!entityId.trim()) {
      setError("Entity ID is required (e.g. Rasse.Hausregel1).");
      return;
    }
    const payload = { entityId: entityId.trim(), data, notes: notes || null };
    const res = editing
      ? await fetch(`/api/manage/chargen-data/${category}/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/manage/chargen-data/${category}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Save failed");
      return;
    }
    setEditorOpen(false);
    await load();
  }

  async function doDelete(row: DbRow) {
    await fetch(`/api/manage/chargen-data/${category}/${row.id}`, {
      method: "DELETE",
    });
    setConfirmDelete(null);
    await load();
  }

  async function doDeleteAll() {
    setDeleteAllBusy(true);
    try {
      const res = await fetch(`/api/manage/chargen-data/${category}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        deleted?: number;
        error?: string;
      };
      if (!res.ok) {
        setXmlMessage(body.error || "Failed to delete all entries.");
        return;
      }
      setXmlMessage(
        `Removed ${body.deleted ?? 0} custom ${CATEGORY_LABELS[category].toLowerCase()} entries.`
      );
      setConfirmDeleteAll(false);
      await load();
    } finally {
      setDeleteAllBusy(false);
    }
  }

  const isXmlCategory = CHARBUILDER_XML_CATEGORIES.includes(
    category as CharbuilderXmlCategory
  );
  const isBausteinCategory = CHARBUILDER_BAUSTEIN_CATEGORIES.includes(
    category as CharbuilderBausteinCategory
  );
  const supportsXmlIo = isXmlCategory || isBausteinCategory;

  async function handleXmlImport(files: FileList | File[]) {
    setXmlMessage(null);
    setXmlBusy(true);
    try {
      const fileList = Array.from(files);
      if (!fileList.length) return;

      if (isBausteinCategory) {
        const cat = category as CharbuilderBausteinCategory;
        const parsedItems: CatalogItem[] = [];
        const fileErrors: string[] = [];
        for (const file of fileList) {
          try {
            const text = await file.text();
            const detected = detectCharbuilderBausteinCategory(text);
            if (!detected) {
              fileErrors.push(
                `${file.name}: unrecognized XML — expected <Rasse>/<Kultur>/<Profession>.`
              );
              continue;
            }
            if (detected !== cat) {
              fileErrors.push(
                `${file.name}: looks like ${CATEGORY_LABELS[detected]} data.`
              );
              continue;
            }
            const item = parseCharbuilderBausteinXml(detected, text);
            if (!item.id) {
              fileErrors.push(`${file.name}: missing Id.`);
              continue;
            }
            parsedItems.push(item);
          } catch (e) {
            fileErrors.push(
              `${file.name}: ${e instanceof Error ? e.message : "parse failed"}`
            );
          }
        }
        if (!parsedItems.length) {
          throw new Error(
            fileErrors.length
              ? fileErrors.join(" ")
              : "No entries found in selected files."
          );
        }
        const res = await fetch(`/api/manage/chargen-data/${category}/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: parsedItems.map((item) => ({
              entityId: item.id,
              data: item,
            })),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          imported?: number;
          total?: number;
          errors?: string[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Import failed");
        const parts = [
          `Imported ${body.imported ?? 0} of ${body.total ?? parsedItems.length} entries from ${fileList.length} file(s).`,
        ];
        if (fileErrors.length) parts.push(`${fileErrors.length} file(s) skipped.`);
        if (body.errors?.length) parts.push(`${body.errors.length} row(s) failed.`);
        if (fileErrors.length) parts.push(fileErrors.slice(0, 3).join(" "));
        setXmlMessage(parts.join(" "));
        await load();
        return;
      }

      // Equipment: single multi-entry XML file (existing behavior)
      const file = fileList[0];
      const text = await file.text();
      const detected = detectCharbuilderXmlCategory(text);
      if (!detected) {
        throw new Error(
          "Unrecognized XML — expected a Charbuilder <Waffen>/<Fernwaffen>/<Ruestungen>/<Schilde> file."
        );
      }
      if (detected !== category) {
        throw new Error(
          `This file looks like ${CATEGORY_LABELS[detected]} data. Switch to that category and retry.`
        );
      }
      const parsed = parseCharbuilderXml(detected, text);
      if (!parsed.length) {
        throw new Error("No entries found in file.");
      }
      const res = await fetch(`/api/manage/chargen-data/${category}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: parsed.map((item) => ({ entityId: item.id, data: item })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        imported?: number;
        total?: number;
        errors?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error || "Import failed");
      setXmlMessage(
        `Imported ${body.imported ?? 0} of ${body.total ?? parsed.length} entries.` +
          (body.errors?.length ? ` ${body.errors.length} skipped.` : "")
      );
      await load();
    } catch (e) {
      setXmlMessage(e instanceof Error ? e.message : "Import failed");
    } finally {
      setXmlBusy(false);
    }
  }

  function handleXmlExport() {
    const cat = category as CharbuilderXmlCategory;
    const catalogItems: CatalogItem[] = items.map((row) => ({
      ...(row.data as CatalogItem),
      id: row.entityId,
    }));
    downloadCharbuilderXml(cat, catalogItems, `${cat}_custom.xml`);
  }

  function handleBausteinExportOne(row: DbRow) {
    const cat = category as CharbuilderBausteinCategory;
    const item: CatalogItem = {
      ...(row.data as CatalogItem),
      id: row.entityId,
    };
    downloadBausteinXml(cat, item);
  }

  function handleBausteinExportAll() {
    const cat = category as CharbuilderBausteinCategory;
    const files: Record<string, Uint8Array> = {};
    const usedNames = new Set<string>();
    for (const row of items) {
      const item: CatalogItem = {
        ...(row.data as CatalogItem),
        id: row.entityId,
      };
      let name = charbuilderBausteinFilename(cat, item);
      if (usedNames.has(name)) {
        const base = name.replace(/\.[^.]+$/, "");
        const ext = name.slice(base.length);
        let i = 2;
        while (usedNames.has(`${base}_${i}${ext}`)) i++;
        name = `${base}_${i}${ext}`;
      }
      usedNames.add(name);
      files[name] = strToU8(serializeCharbuilderBausteinXml(cat, item));
    }
    const zipped = zipSync(files);
    const blob = new Blob([new Uint8Array(zipped)], {
      type: "application/zip",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cat}_custom.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const fileAccept = isBausteinCategory
    ? charbuilderBausteinAccept(category as CharbuilderBausteinCategory)
    : ".xml,application/xml,text/xml";

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {CHARGEN_CATALOG_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              category === c
                ? "bg-brand text-white"
                : "bg-surface-sidebar text-ink-muted hover:text-ink"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {warning && (
        <div className="mb-4 rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {warning}
        </div>
      )}

      <div className="flex justify-between items-center mb-3 gap-2">
        <h2 className="font-semibold text-ink">{CATEGORY_LABELS[category]}</h2>
        <div className="flex gap-2">
          {supportsXmlIo && (
            <>
              <input
                ref={xmlInputRef}
                type="file"
                accept={fileAccept}
                multiple={isBausteinCategory}
                className="hidden"
                onChange={(e) => {
                  const list = e.target.files;
                  if (list?.length) void handleXmlImport(list);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={xmlBusy}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-ink-muted hover:text-ink text-sm disabled:opacity-50"
                onClick={() => xmlInputRef.current?.click()}
                title={
                  isBausteinCategory
                    ? "Import Charbuilder race/culture/profession files (.ras/.kul/.pro or .xml) — one entry per file"
                    : "Import a Charbuilder-format XML file (same attributes as the original tool)"
                }
              >
                {xmlBusy ? "Importing…" : "Import XML"}
              </button>
              {isXmlCategory && (
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-surface-border text-ink-muted hover:text-ink text-sm disabled:opacity-50"
                  disabled={!items.length}
                  onClick={handleXmlExport}
                  title="Export custom entries in this category to Charbuilder-format XML"
                >
                  Export XML
                </button>
              )}
              {isBausteinCategory && (
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-surface-border text-ink-muted hover:text-ink text-sm disabled:opacity-50"
                  disabled={!items.length}
                  onClick={handleBausteinExportAll}
                  title="Export all custom entries as a .zip (one .ras/.kul/.pro file per entry)"
                >
                  Export all (.zip)
                </button>
              )}
            </>
          )}
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-red-900/60 text-red-300 hover:text-red-200 text-sm disabled:opacity-50"
            disabled={!items.length || deleteAllBusy}
            onClick={() => setConfirmDeleteAll(true)}
            title="Delete all custom entries in this category"
          >
            Remove all
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm"
            onClick={openCreate}
          >
            Add entry
          </button>
        </div>
      </div>

      {xmlMessage && (
        <div className="mb-3 rounded-lg border border-surface-border bg-[#1a1410] px-3 py-2 text-sm text-ink-muted">
          {xmlMessage}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-faint">No custom entries yet.</p>
      ) : (
        <ul className="divide-y divide-surface-border rounded-xl border border-surface-border overflow-hidden">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-3 px-3 py-2 bg-[#1a1410]"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {(row.data?.name as string) || row.entityId}
                </div>
                <div className="text-xs text-ink-faint truncate">
                  {row.entityId}
                </div>
              </div>
              <button
                type="button"
                className="text-sm text-ink-muted hover:text-ink"
                onClick={() => openEdit(row)}
              >
                Edit
              </button>
              {isBausteinCategory && (
                <button
                  type="button"
                  className="text-sm text-ink-muted hover:text-ink"
                  onClick={() => handleBausteinExportOne(row)}
                  title="Export this entry as a single Charbuilder .ras/.kul/.pro file"
                >
                  Export
                </button>
              )}
              <button
                type="button"
                className="text-sm text-red-300 hover:text-red-200"
                onClick={() => setConfirmDelete(row)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {editorOpen && (
        <BodyPortal>
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
              <h3 className="text-lg font-bold mb-3">
                {editing ? "Edit" : "Create"} {CATEGORY_LABELS[category]}
              </h3>
              <label className="block text-sm mb-3">
                <span className="text-ink-muted">Entity ID</span>
                <input
                  className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-2 py-2 text-ink"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                  placeholder="Rasse.Hausregel1"
                />
              </label>
              <label className="block text-sm mb-3">
                <span className="text-ink-muted">
                  Data JSON (same shape as built-in catalog entries)
                </span>
                <textarea
                  className="mt-1 w-full h-64 font-mono text-xs rounded border border-surface-border bg-[#2c251f] px-2 py-2 text-ink"
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                />
              </label>
              <label className="block text-sm mb-3">
                <span className="text-ink-muted">Notes</span>
                <input
                  className="mt-1 w-full rounded border border-surface-border bg-[#2c251f] px-2 py-2 text-ink"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              {error && (
                <p className="text-sm text-red-300 mb-2" role="alert">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted"
                  onClick={() => setEditorOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm bg-brand text-white"
                  onClick={() => void save()}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </BodyPortal>
      )}

      {confirmDelete && (
        <BodyPortal>
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
              <p className="text-sm text-ink mb-4">
                Delete{" "}
                <strong>
                  {(confirmDelete.data?.name as string) ||
                    confirmDelete.entityId}
                </strong>
                ?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm bg-red-800 text-white"
                  onClick={() => void doDelete(confirmDelete)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </BodyPortal>
      )}

      {confirmDeleteAll && (
        <BodyPortal>
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
              <p className="text-sm text-ink mb-4">
                Delete all{" "}
                <strong>
                  {items.length} custom {CATEGORY_LABELS[category]}
                </strong>{" "}
                entries? Built-in catalog data is not affected.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm text-ink-muted"
                  disabled={deleteAllBusy}
                  onClick={() => setConfirmDeleteAll(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg text-sm bg-red-800 text-white disabled:opacity-50"
                  disabled={deleteAllBusy}
                  onClick={() => void doDeleteAll()}
                >
                  {deleteAllBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </BodyPortal>
      )}
    </div>
  );
}
