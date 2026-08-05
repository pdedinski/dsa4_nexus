"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHARGEN_CATALOG_CATEGORIES,
  type ChargenCatalogCategory,
} from "@/lib/chargen/types";
import BodyPortal from "@/components/ui/BodyPortal";

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

      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold text-ink">{CATEGORY_LABELS[category]}</h2>
        <button
          type="button"
          className="px-3 py-1.5 rounded-lg bg-brand text-white text-sm"
          onClick={openCreate}
        >
          Add entry
        </button>
      </div>

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
    </div>
  );
}
