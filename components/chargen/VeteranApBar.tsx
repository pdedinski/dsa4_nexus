"use client";

import type { HeldModel } from "@/lib/chargen/types";
import { apCredit } from "@/lib/chargen/rules/veteran";

export default function VeteranApBar({ held }: { held: HeldModel }) {
  const credit = apCredit(held);
  const over = credit < 0;
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-surface-border bg-[#1a1410] px-4 py-2 text-sm shadow-md">
      <span className="font-semibold text-ink">Adventure Points</span>
      <span className="text-ink">
        Total: <span className="font-mono">{held.apTotal}</span>
      </span>
      <span className="text-ink">
        Used: <span className="font-mono">{held.apSpent}</span>
      </span>
      <span
        className={over ? "text-red-400 font-medium" : "text-brand"}
        title="AP remaining to spend"
      >
        AP-Credit: <span className="font-mono">{credit}</span>
      </span>
      {over && (
        <span className="text-xs text-red-300/90">
          {Math.abs(credit)} AP to spend (overspent)
        </span>
      )}
    </div>
  );
}
