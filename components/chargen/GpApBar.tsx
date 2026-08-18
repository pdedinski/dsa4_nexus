"use client";

import type { BudgetSnapshot } from "@/lib/chargen/rules/budget";

export default function GpApBar({
  budget,
  onOpenSettings,
  onReset,
}: {
  budget: BudgetSnapshot;
  onOpenSettings?: () => void;
  onReset?: () => void;
}) {
  const hasEducated =
    (budget.educatedApSaved ?? 0) > 0 || (budget.educatedApRemaining ?? 0) > 0;
  const hasMagic =
    (budget.magicApBudget ?? 0) > 0 || (budget.magicApSpent ?? 0) > 0;

  return (
    <div className="z-20 flex shrink-0 flex-wrap items-center gap-3 border-b border-surface-border bg-[#1a1410] px-4 py-2 text-sm shadow-md">
      <span className="font-semibold text-ink">Budgets</span>
      <span
        className={
          budget.gpRemaining < 0 ? "text-red-400 font-medium" : "text-ink"
        }
      >
        GP: {budget.gpRemaining} to spend
        <span className="text-ink-faint"> / {budget.gpStart}</span>
        {budget.gpSpecialAbilities > 0
          ? ` (SF ${budget.gpSpecialAbilities})`
          : ""}
      </span>
      <span className="text-ink-faint">|</span>
      <span
        className={
          budget.apRemaining < 0 ? "text-red-400 font-medium" : "text-ink"
        }
        title={
          hasEducated || hasMagic
            ? `Educated savings: ${budget.educatedApRemaining ?? 0}; magic AP: ${budget.magicApRemaining ?? 0} of ${budget.magicApBudget ?? 0}`
            : undefined
        }
      >
        AP: {budget.apRemaining} / {budget.apStart}
        {hasEducated
          ? ` (${budget.educatedApRemaining ?? 0} Educated)`
          : ""}
        {hasMagic
          ? `, ${budget.magicApRemaining ?? 0} for spells`
          : ""}
      </span>
      <span className="text-ink-faint text-xs ml-auto flex items-center gap-2">
        <span>
          Race {budget.gpRace} · Culture {budget.gpCulture} · Profession{" "}
          {budget.gpProfession} · Attributes {budget.gpAttributes}
          {budget.gpTraits !== 0 ? ` · Traits ${budget.gpTraits}` : ""}
        </span>
        {onReset ? (
          <button
            type="button"
            className="rounded border border-surface-border px-2 py-0.5 text-xs text-ink hover:bg-surface-sidebar/60"
            onClick={onReset}
            title="Reset character generator"
          >
            Reset
          </button>
        ) : null}
        {onOpenSettings ? (
          <button
            type="button"
            className="rounded border border-surface-border px-2 py-0.5 text-xs hover:bg-surface-sidebar/60"
            onClick={onOpenSettings}
            title="Generator settings"
          >
            Settings
          </button>
        ) : null}
      </span>
    </div>
  );
}
