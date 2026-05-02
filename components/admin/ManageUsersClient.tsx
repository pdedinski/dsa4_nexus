"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Pencil, Trash2, Check, X, AlertCircle } from "lucide-react";
import clsx from "clsx";

interface UserRow {
  id: string;
  email: string | null;
  displayName: string;
  firstLoginAt: string;
  lastLoginAt: string;
  isAllowed: boolean;
  isEditor: boolean;
  isAdmin: boolean;
  isSuperuser: boolean;
}

interface Props {
  currentUserId: string;
  isSuperuser: boolean;
}

export default function ManageUsersClient({
  currentUserId,
  isSuperuser,
}: Props) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    isAllowed: boolean;
    isEditor: boolean;
    isAdmin: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setEditFields({
      isAllowed: u.isAllowed,
      isEditor: u.isEditor,
      isAdmin: u.isAdmin,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFields(null);
    setError(null);
  }

  async function saveEdit(userId: string) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...editFields }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditFields(null);
      load(search);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save.");
    }
  }

  async function deleteUser(userId: string) {
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setConfirmDelete(null);
      load(search);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete.");
      setConfirmDelete(null);
    }
  }

  function canEdit(u: UserRow): boolean {
    if (u.id === currentUserId) return false;
    if (!isSuperuser && (u.isSuperuser || u.isAdmin)) return false;
    return true;
  }

  function canDelete(u: UserRow): boolean {
    return canEdit(u);
  }

  const handleSearch = (q: string) => {
    setSearch(q);
    load(q);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-card border border-surface-border text-ink text-sm placeholder:text-ink-faint focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-surface-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-card border-b border-surface-border">
              <th className="text-left px-4 py-3 text-ink-muted font-medium">
                User
              </th>
              <th className="text-center px-3 py-3 text-ink-muted font-medium">
                Allowed
              </th>
              <th className="text-center px-3 py-3 text-ink-muted font-medium">
                Editor
              </th>
              <th className="text-center px-3 py-3 text-ink-muted font-medium">
                Admin
              </th>
              <th className="text-left px-3 py-3 text-ink-muted font-medium">
                Last Login
              </th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-ink-muted py-8 px-4"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-ink-muted py-8 px-4"
                >
                  No users found.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isEditing = editingId === u.id;
              const isSelf = u.id === currentUserId;
              const editable = canEdit(u);

              return (
                <tr
                  key={u.id}
                  className={clsx(
                    "border-b border-surface-border last:border-0 transition-colors",
                    isSelf
                      ? "bg-brand-muted/10"
                      : "hover:bg-surface-card/50"
                  )}
                >
                  {/* User info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-muted border border-brand flex items-center justify-center text-xs text-ink font-bold shrink-0">
                        {(u.displayName ?? u.email ?? "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-ink font-medium">
                          {u.displayName}
                          {isSelf && (
                            <span className="ml-1 text-xs text-ink-muted">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-ink-muted text-xs">{u.email}</p>
                      </div>
                    </div>
                    {u.isSuperuser && (
                      <span className="mt-1 inline-block text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-400 border border-yellow-800">
                        superuser
                      </span>
                    )}
                  </td>

                  {/* Boolean flags */}
                  {(["isAllowed", "isEditor", "isAdmin"] as const).map(
                    (field) => (
                      <td key={field} className="text-center px-3 py-3">
                        {isEditing && editFields ? (
                          <input
                            type="checkbox"
                            checked={editFields[field]}
                            onChange={(e) =>
                              setEditFields((f) =>
                                f ? { ...f, [field]: e.target.checked } : f
                              )
                            }
                            className="w-4 h-4 accent-brand cursor-pointer"
                          />
                        ) : (
                          <span
                            className={clsx(
                              "inline-flex items-center justify-center w-5 h-5 rounded",
                              u[field]
                                ? "bg-green-900/40 text-green-400"
                                : "bg-surface-border text-ink-faint"
                            )}
                          >
                            {u[field] ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </td>
                    )
                  )}

                  {/* Last login */}
                  <td className="px-3 py-3 text-ink-muted text-xs">
                    {new Date(u.lastLoginAt).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => saveEdit(u.id)}
                          title="Save"
                          className="p-1.5 rounded bg-brand hover:bg-brand-dark text-white transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancel"
                          className="p-1.5 rounded hover:bg-surface-border text-ink-muted hover:text-ink transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        {editable && (
                          <>
                            <button
                              onClick={() => startEdit(u)}
                              title="Edit"
                              className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-surface-border transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDelete === u.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  title="Confirm delete"
                                  className="p-1.5 rounded bg-red-700 hover:bg-red-800 text-white transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  title="Cancel"
                                  className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-surface-border transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              canDelete(u) && (
                                <button
                                  onClick={() => setConfirmDelete(u.id)}
                                  title="Delete"
                                  className="p-1.5 rounded text-ink-muted hover:text-red-400 hover:bg-surface-border transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
