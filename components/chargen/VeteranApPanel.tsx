"use client";

import { useState } from "react";
import type { HeldModel } from "@/lib/chargen/types";
import {
  addAp,
  apCredit,
  setApSpent,
  setApTotal,
} from "@/lib/chargen/rules/veteran";

export default function VeteranApPanel({
  held,
  updateHeld,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
}) {
  const [addAmount, setAddAmount] = useState(100);
  const credit = apCredit(held);

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-lg font-bold">Adventure Points</h2>
      <p className="text-sm text-ink-muted">
        Add AP earned from adventures. Total and used AP can be edited directly
        (mirrors Java PanelAp). Lowering values after a save/reload does not
        refund AP spent above the current baseline.
      </p>

      <label className="block text-sm">
        <span className="text-ink-muted">Adventure Points (total)</span>
        <input
          type="number"
          min={0}
          max={99999}
          className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
          value={held.apTotal}
          onChange={(e) =>
            updateHeld((h) => setApTotal(h, Number(e.target.value) || 0))
          }
        />
      </label>

      <label className="block text-sm">
        <span className="text-ink-muted">Used AP</span>
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
          value={held.apSpent}
          onChange={(e) =>
            updateHeld((h) => setApSpent(h, Number(e.target.value) || 0))
          }
        />
      </label>

      <p className="text-sm">
        <span className="text-ink-muted">AP-Credit: </span>
        <span
          className={`font-mono font-medium ${
            credit < 0 ? "text-red-400" : "text-ink"
          }`}
        >
          {credit}
        </span>
      </p>

      <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-surface-border">
        <label className="block text-sm flex-1 min-w-[8rem]">
          <span className="text-ink-muted">AP to add</span>
          <input
            type="number"
            min={1}
            max={99999}
            className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
            value={addAmount}
            onChange={(e) => setAddAmount(Number(e.target.value) || 0)}
          />
        </label>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium"
          onClick={() => updateHeld((h) => addAp(h, addAmount))}
        >
          Add
        </button>
      </div>
    </div>
  );
}
