"use client";

import type { Konflikt } from "@/lib/chargen/rules/voraussetzungen";

export default function ProblemsPanel({
  conflicts,
  canFinish,
  advisoryMode,
}: {
  conflicts: Konflikt[];
  canFinish: boolean;
  advisoryMode?: boolean;
}) {
  if (!conflicts.length) {
    return (
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-4 text-sm text-emerald-200">
        No problems detected. You can finish this hero.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {!canFinish && !advisoryMode && (
        <p className="text-sm text-amber-300">
          Resolve all errors before finishing.
        </p>
      )}
      {advisoryMode && conflicts.some((c) => c.severity === "error") && (
        <p className="text-sm text-amber-300">
          Problems are advisory only — you may still finish this hero.
        </p>
      )}
      <ul className="space-y-1.5">
        {conflicts.map((c) => (
          <li
            key={`${c.code}-${c.message}`}
            className={`rounded-md border px-3 py-2 text-sm ${
              c.severity === "error"
                ? "border-red-800/70 bg-red-950/40 text-red-200"
                : "border-amber-800/60 bg-amber-950/30 text-amber-100"
            }`}
          >
            <span className="font-medium uppercase text-xs tracking-wide mr-2">
              {c.severity}
            </span>
            {c.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
