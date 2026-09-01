"use client";

import { useEffect, useState } from "react";
import type { AttributeMods, DerivedCode, HeldModel } from "@/lib/chargen/types";
import { derivedValue } from "@/lib/chargen/types";
import {
  applyGreatMeditation,
  baseValueZukaufCap,
  baseValueZukaufCost,
  GREAT_MEDITATION_AP_COST,
  GREAT_MEDITATION_SF_ID,
  isBaseValuePurchasable,
  lowerBaseValueZukauf,
  raiseBaseValueZukauf,
} from "@/lib/chargen/rules/veteran";
import { hasSpecialAbility } from "@/lib/chargen/rules/kosten";
import BodyPortal from "@/components/ui/BodyPortal";

const LABELS: Partial<Record<DerivedCode, string>> = {
  VP: "Vitality Points (VP)",
  EP: "Endurance Points (EP)",
  RM: "Magic Resistance (RM)",
  ASP: "Magic Points (ASP)",
};

const PURCHASABLE: DerivedCode[] = ["VP", "EP", "RM", "ASP"];

/** Java PanelBasiswerteSteigern only offers Spezielle Erfahrung for LE (VP) and AU (EP). */
const SE_ELIGIBLE = new Set<DerivedCode>(["VP", "EP"]);

/** Non-purchasable combat / wound bases — shown read-only like Java Basiswerte. */
const READONLY: { code: DerivedCode; label: string }[] = [
  { code: "WT", label: "Wound Threshold" },
  { code: "baseAT", label: "Base Attack Value" },
  { code: "basePA", label: "Base Parry Value" },
  { code: "baseBRV", label: "Base Ranged Value" },
  { code: "baseINI", label: "Base Initiative Value" },
];

function setDerivedSpecialExperience(
  held: HeldModel,
  code: DerivedCode,
  on: boolean
): HeldModel {
  const hasRow = held.derived.some((d) => d.code === code);
  if (!hasRow) {
    return {
      ...held,
      derived: [
        ...held.derived,
        {
          code,
          base: 0,
          modification: 0,
          purchased: 0,
          specialExperience: on,
        },
      ],
    };
  }
  return {
    ...held,
    derived: held.derived.map((d) =>
      d.code === code ? { ...d, specialExperience: on } : d
    ),
  };
}

function GreatMeditationDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (bonus: number) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setText("");
    setError(null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  function submit() {
    const trimmed = text.trim();
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n) || String(n) !== trimmed) {
      setError("Enter a whole number.");
      return;
    }
    onConfirm(n);
  }

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/80 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="great-meditation-title"
          className="w-full max-w-sm rounded-xl border border-surface-border bg-[#1a1410] p-4 shadow-2xl"
        >
          <h2
            id="great-meditation-title"
            className="text-lg font-bold text-ink"
          >
            Input
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            How high is the ASP bonus?
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            Costs {GREAT_MEDITATION_AP_COST} AP (Java Great Meditation). Cannot
            be undone.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            className="mt-3 w-full rounded-lg border border-surface-border bg-surface-card px-3 py-2 font-mono text-sm text-ink"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          {error && (
            <p className="mt-1 text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              onClick={submit}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}

export default function BaseValuesStepPanel({
  held,
  updateHeld,
  attributeMods,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  attributeMods?: AttributeMods;
}) {
  const [meditationOpen, setMeditationOpen] = useState(false);
  const hasGreatMeditation = hasSpecialAbility(held, GREAT_MEDITATION_SF_ID);

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-lg font-bold">Base values</h2>
      <p className="text-sm text-ink-muted">
        Buy VP, EP, RM, and ASP with AP. Layout matches Java Basiswerte
        Steigern: base + bought (next AP) = sum. SE lowers the next-raise
        column for VP and EP.
      </p>
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-ink-muted text-left">
              <th className="px-3 py-2 font-medium">Base value</th>
              <th className="px-2 py-2 font-medium text-center">Bought</th>
              <th className="px-2 py-2 font-medium text-right">Sum</th>
              <th
                className="px-3 py-2 font-medium text-center"
                title="Special Experience / Great Meditation"
              >
                SE
              </th>
            </tr>
          </thead>
          <tbody>
            {PURCHASABLE.map((code) => {
              if (!isBaseValuePurchasable(code)) return null;
              const row = held.derived.find((d) => d.code === code);
              const purchased = row?.purchased ?? 0;
              const cap = baseValueZukaufCap(held, code, attributeMods);
              const seOn = row?.specialExperience === true;
              const canSe = SE_ELIGIBLE.has(code);
              const nextCost = baseValueZukaufCost(
                held,
                code,
                canSe ? seOn : false
              );
              const sum = derivedValue(held, code);
              const withoutBought = sum - purchased;
              return (
                <tr
                  key={code}
                  className="border-b border-surface-border/60 last:border-0"
                >
                  <td className="px-3 py-2">
                    <div>{LABELS[code] ?? code}</div>
                    <div className="text-xs text-ink-faint font-mono">
                      Cap {cap}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1 font-mono">
                      <span className="text-ink-muted tabular-nums">
                        {withoutBought}
                      </span>
                      <span className="text-ink-faint">+</span>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                        disabled={purchased <= 0}
                        onClick={() =>
                          updateHeld((h) => lowerBaseValueZukauf(h, code))
                        }
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums">
                        {purchased}
                      </span>
                      <button
                        type="button"
                        className="px-2 py-0.5 rounded border border-surface-border disabled:opacity-40"
                        disabled={purchased >= cap}
                        title={
                          purchased >= cap
                            ? "At buy cap"
                            : `Next raise: ${nextCost} AP`
                        }
                        onClick={() =>
                          updateHeld((h) =>
                            raiseBaseValueZukauf(h, code, attributeMods)
                          )
                        }
                      >
                        +
                      </button>
                      <span
                        className="text-ink-muted tabular-nums min-w-[2.5rem]"
                        title="AP cost of the next raise"
                      >
                        {purchased >= cap ? "(—)" : `(${nextCost})`}
                      </span>
                      <span className="text-ink-faint">=</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {sum}
                  </td>
                  <td className="px-3 py-2 text-center align-middle">
                    {canSe ? (
                      <input
                        type="checkbox"
                        className="rounded"
                        title="Special Experience (cheaper next raise)"
                        checked={seOn}
                        onChange={(e) => {
                          const on = e.target.checked;
                          updateHeld((h) =>
                            setDerivedSpecialExperience(h, code, on)
                          );
                        }}
                      />
                    ) : code === "ASP" ? (
                      <button
                        type="button"
                        className="rounded border border-surface-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-surface-sidebar"
                        disabled={!hasGreatMeditation}
                        title={
                          hasGreatMeditation
                            ? `Add ASP bonus for ${GREAT_MEDITATION_AP_COST} AP`
                            : "Requires special ability Great Meditation"
                        }
                        onClick={() => setMeditationOpen(true)}
                      >
                        Great Meditation
                      </button>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-ink-muted text-left">
              <th className="px-3 py-2 font-medium">Derived</th>
              <th className="px-3 py-2 font-medium text-right">Current</th>
            </tr>
          </thead>
          <tbody>
            {READONLY.map(({ code, label }) => (
              <tr
                key={code}
                className="border-b border-surface-border/60 last:border-0"
              >
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {derivedValue(held, code)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GreatMeditationDialog
        open={meditationOpen}
        onCancel={() => setMeditationOpen(false)}
        onConfirm={(bonus) => {
          setMeditationOpen(false);
          updateHeld((h) => applyGreatMeditation(h, bonus));
        }}
      />
    </div>
  );
}
