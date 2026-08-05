"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type { CombatantDto } from "@/lib/combat/combatTrackerTypes";
import { isActiveCombatant } from "@/lib/combat/combatTrackerSort";

export default function CombatantRow({
  combatant,
  isTurnActive,
  canMoveUp,
  canMoveDown,
  busy,
  onPatch,
  onApplyDamage,
  onMove,
  onAdvanceTurn,
  onDuplicate,
  onDelete,
}: {
  combatant: CombatantDto;
  isTurnActive: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  busy: boolean;
  onPatch: (
    id: string,
    patch: Partial<Pick<CombatantDto, "name" | "ini" | "vp" | "asp" | "ar">>
  ) => Promise<void>;
  onApplyDamage: (id: string, damageDealt: number) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => Promise<void>;
  onAdvanceTurn: () => Promise<void>;
  onDuplicate: (c: CombatantDto) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(combatant.name);
  const [ini, setIni] = useState(String(combatant.ini));
  const [vp, setVp] = useState(String(combatant.vp));
  const [asp, setAsp] = useState(String(combatant.asp));
  const [ar, setAr] = useState(String(combatant.ar));
  const [damageDealt, setDamageDealt] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setName(combatant.name);
    setIni(String(combatant.ini));
    setVp(String(combatant.vp));
    setAsp(String(combatant.asp));
    setAr(String(combatant.ar));
  }, [combatant]);

  useEffect(() => {
    if (isTurnActive && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isTurnActive, combatant.id]);

  const incapacitated = !isActiveCombatant(combatant);

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === combatant.name) {
      setName(combatant.name);
      return;
    }
    await onPatch(combatant.id, { name: trimmed });
  }

  async function commitNum(
    field: "ini" | "vp" | "asp" | "ar",
    raw: string,
    current: number
  ) {
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n) || n === current) {
      if (field === "ini") setIni(String(combatant.ini));
      if (field === "vp") setVp(String(combatant.vp));
      if (field === "asp") setAsp(String(combatant.asp));
      if (field === "ar") setAr(String(combatant.ar));
      return;
    }
    await onPatch(combatant.id, { [field]: n });
  }

  async function applyDamage() {
    const n = Math.trunc(Number(damageDealt));
    if (!Number.isFinite(n)) return;
    setApplying(true);
    try {
      await onApplyDamage(combatant.id, n);
      setDamageDealt("");
    } finally {
      setApplying(false);
    }
  }

  const numCls =
    "w-11 shrink-0 rounded border border-surface-border bg-surface-sidebar px-1 py-0.5 text-center font-mono text-xs tabular-nums text-ink scheme-dark [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-60";

  const iconBtn =
    "rounded border border-surface-border p-1 text-ink-muted hover:bg-surface-sidebar hover:text-ink disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      ref={rowRef}
      className={clsx(
        "rounded-lg border px-2 py-1.5 transition-colors",
        isTurnActive
          ? "border-brand/40 bg-brand-muted/40"
          : "border-surface-border bg-surface-card"
      )}
    >
      {/* Row 1: tick · name · manage buttons */}
      <div className="flex items-center gap-1.5">
        <div className="flex w-7 shrink-0 items-center justify-center">
          {isTurnActive ? (
            <button
              type="button"
              title="End turn / next combatant"
              disabled={busy}
              className="rounded-full bg-emerald-700/80 p-1 text-white hover:bg-emerald-600 disabled:opacity-50"
              onClick={() => void onAdvanceTurn()}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="h-5 w-5" aria-hidden />
          )}
        </div>

        <input
          className={clsx(
            "min-w-0 flex-1 rounded border border-surface-border bg-surface-sidebar px-2 py-0.5 text-sm text-ink scheme-dark",
            incapacitated && "line-through text-ink-muted"
          )}
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void commitName()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Move up"
            disabled={busy || incapacitated || !canMoveUp}
            className={iconBtn}
            onClick={() => void onMove(combatant.id, "up")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Move down"
            disabled={busy || incapacitated || !canMoveDown}
            className={iconBtn}
            onClick={() => void onMove(combatant.id, "down")}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Duplicate"
            disabled={busy}
            className={iconBtn}
            onClick={() => onDuplicate(combatant)}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete"
            disabled={busy}
            className="rounded border border-red-900/50 p-1 text-red-400 hover:bg-red-950/30 disabled:opacity-50"
            onClick={() => void onDelete(combatant.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: INI · VP · ASP · AR · Damage Dealt */}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-8">
        <label className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted">
          INI
          <input
            type="number"
            className={numCls}
            value={ini}
            disabled={busy}
            onChange={(e) => setIni(e.target.value)}
            onBlur={() => void commitNum("ini", ini, combatant.ini)}
          />
        </label>

        <label className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted">
          VP
          <input
            type="number"
            className={numCls}
            value={vp}
            disabled={busy}
            onChange={(e) => setVp(e.target.value)}
            onBlur={() => void commitNum("vp", vp, combatant.vp)}
          />
          {combatant.lastDamageApplied != null ? (
            <span className="shrink-0 font-mono text-[10px] text-red-400">
              {`( -${combatant.lastDamageApplied} )`}
            </span>
          ) : null}
        </label>

        <label className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted">
          ASP
          <input
            type="number"
            className={numCls}
            value={asp}
            disabled={busy}
            onChange={(e) => setAsp(e.target.value)}
            onBlur={() => void commitNum("asp", asp, combatant.asp)}
          />
        </label>

        <label className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted">
          AR
          <input
            type="number"
            className={numCls}
            value={ar}
            disabled={busy}
            onChange={(e) => setAr(e.target.value)}
            onBlur={() => void commitNum("ar", ar, combatant.ar)}
          />
        </label>

        <label className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-muted">
          Damage Dealt
          <input
            type="number"
            className={numCls}
            value={damageDealt}
            disabled={busy || applying}
            onChange={(e) => setDamageDealt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void applyDamage();
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy || applying || damageDealt.trim() === ""}
          className={clsx(
            "rounded bg-brand px-2 py-0.5 text-xs font-medium text-white hover:opacity-90",
            (busy || applying || damageDealt.trim() === "") &&
              "cursor-not-allowed opacity-50"
          )}
          onClick={() => void applyDamage()}
        >
          {applying ? "…" : "Apply"}
        </button>
      </div>
    </div>
  );
}
