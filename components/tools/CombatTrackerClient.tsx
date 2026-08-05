"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Plus, RotateCcw } from "lucide-react";
import clsx from "clsx";
import BodyPortal from "@/components/ui/BodyPortal";
import type {
  CombatantDto,
  CombatTrackerDto,
} from "@/lib/combat/combatTrackerTypes";
import { getActiveCombatants } from "@/lib/combat/combatTrackerSort";
import AddCombatantModal, {
  type CombatantDraft,
} from "@/components/tools/AddCombatantModal";
import CombatantRow from "@/components/tools/CombatantRow";

const EMPTY: CombatTrackerDto = {
  turnNumber: 1,
  activeCombatantId: null,
  combatants: [],
};

export default function CombatTrackerClient() {
  const [tracker, setTracker] = useState<CombatTrackerDto>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Add Combatant");
  const [modalInitial, setModalInitial] = useState<CombatantDraft | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const applyTracker = useCallback((data: CombatTrackerDto) => {
    setTracker(data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/combat-tracker");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load combat tracker.");
        return;
      }
      applyTracker(data as CombatTrackerDto);
    } finally {
      setLoading(false);
    }
  }, [applyTracker]);

  useEffect(() => {
    void load();
  }, [load]);

  async function readTracker(res: Response): Promise<CombatTrackerDto | null> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Request failed.");
      return null;
    }
    return data as CombatTrackerDto;
  }

  function openAdd() {
    setModalTitle("Add Combatant");
    setModalInitial(null);
    setModalError(null);
    setModalOpen(true);
  }

  function openDuplicate(c: CombatantDto) {
    setModalTitle("Duplicate Combatant");
    setModalInitial({
      name: c.name,
      ini: c.ini,
      vp: c.vp,
      asp: c.asp,
      ar: c.ar,
    });
    setModalError(null);
    setModalOpen(true);
  }

  async function submitCombatant(draft: CombatantDraft) {
    setModalSaving(true);
    setModalError(null);
    setError(null);
    try {
      const res = await fetch("/api/combat-tracker/combatants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setModalError(data.error ?? "Failed to add combatant.");
        return;
      }
      applyTracker(data as CombatTrackerDto);
      setModalOpen(false);
    } finally {
      setModalSaving(false);
    }
  }

  async function patchCombatant(
    id: string,
    patch: Partial<Pick<CombatantDto, "name" | "ini" | "vp" | "asp" | "ar">>
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/combat-tracker/combatants/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }
      );
      const next = await readTracker(res);
      if (next) applyTracker(next);
    } finally {
      setBusy(false);
    }
  }

  async function applyDamage(id: string, damageDealt: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/combat-tracker/combatants/${encodeURIComponent(id)}/apply-damage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ damageDealt }),
        }
      );
      const next = await readTracker(res);
      if (next) applyTracker(next);
    } finally {
      setBusy(false);
    }
  }

  async function moveCombatant(id: string, direction: "up" | "down") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/combat-tracker/combatants/${encodeURIComponent(id)}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        }
      );
      const next = await readTracker(res);
      if (next) applyTracker(next);
    } finally {
      setBusy(false);
    }
  }

  async function advanceTurn() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/combat-tracker/advance-turn", {
        method: "POST",
      });
      const next = await readTracker(res);
      if (next) applyTracker(next);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCombatant(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/combat-tracker/combatants/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const next = await readTracker(res);
      if (next) applyTracker(next);
    } finally {
      setBusy(false);
    }
  }

  async function startCombat() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/combat-tracker/start", { method: "POST" });
      const next = await readTracker(res);
      if (next) applyTracker(next);
    } finally {
      setBusy(false);
    }
  }

  async function resetCombat() {
    setResetting(true);
    setError(null);
    try {
      const res = await fetch("/api/combat-tracker/reset", { method: "POST" });
      const next = await readTracker(res);
      if (next) applyTracker(next);
      setConfirmReset(false);
    } finally {
      setResetting(false);
    }
  }

  const activeList = getActiveCombatants(tracker.combatants);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="rounded-lg border border-brand/30 bg-brand-muted/30 px-4 py-2">
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            Combat Turn
          </span>
          <p className="text-xl font-bold tabular-nums text-ink">
            Turn {tracker.turnNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void startCombat()}
            disabled={busy || tracker.combatants.length === 0}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-800/50",
              (busy || tracker.combatants.length === 0) &&
                "cursor-not-allowed opacity-50"
            )}
          >
            <Play className="h-4 w-4" />
            Start Combat
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Combatant
          </button>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border px-4 py-2 text-sm text-ink-muted hover:bg-surface-sidebar hover:text-ink"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Combat
          </button>
        </div>
      </div>

      {error ? (
        <p
          className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : tracker.combatants.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No combatants yet. Add combatants to start tracking initiative and
          turns.
        </p>
      ) : (
        <ul className="space-y-2">
          {tracker.combatants.map((c) => {
            const activeIdx = activeList.findIndex((a) => a.id === c.id);
            const isActiveInPool = activeIdx >= 0;
            return (
              <li key={c.id}>
                <CombatantRow
                  combatant={c}
                  isTurnActive={tracker.activeCombatantId === c.id}
                  canMoveUp={isActiveInPool && activeIdx > 0}
                  canMoveDown={
                    isActiveInPool && activeIdx < activeList.length - 1
                  }
                  busy={busy}
                  onPatch={patchCombatant}
                  onApplyDamage={applyDamage}
                  onMove={moveCombatant}
                  onAdvanceTurn={advanceTurn}
                  onDuplicate={openDuplicate}
                  onDelete={deleteCombatant}
                />
              </li>
            );
          })}
        </ul>
      )}

      <AddCombatantModal
        open={modalOpen}
        title={modalTitle}
        initial={modalInitial}
        saving={modalSaving}
        error={modalError}
        onClose={() => setModalOpen(false)}
        onSubmit={(d) => void submitCombatant(d)}
      />

      {confirmReset ? (
        <BodyPortal>
          <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl">
              <p className="text-sm text-ink">
                Reset combat? This deletes all combatants and resets the turn
                counter to 1.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sidebar"
                  disabled={resetting}
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={clsx(
                    "rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700",
                    resetting && "opacity-50"
                  )}
                  disabled={resetting}
                  onClick={() => void resetCombat()}
                >
                  {resetting ? "Resetting…" : "Reset Combat"}
                </button>
              </div>
            </div>
          </div>
        </BodyPortal>
      ) : null}
    </div>
  );
}
