"use client";

import {
  assignOpenPick,
  normalizeOpenPicks,
} from "@/lib/chargen/rules/openTalentPicks";

export default function OpenTalentBonusGrid({
  choiceKey,
  ranks,
  talentIds,
  picks,
  labelMap,
  onChange,
}: {
  choiceKey: string;
  ranks: number[];
  talentIds: string[];
  picks: string[];
  labelMap: Record<string, string>;
  onChange: (nextPicks: string[]) => void;
}) {
  const normalized = normalizeOpenPicks(picks, ranks.length);

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-ink-muted border-b border-surface-border">
            <th className="py-1 pr-3 text-left font-medium">Talent</th>
            {ranks.map((rank, idx) => (
              <th
                key={`${choiceKey}-rank-${idx}`}
                className="py-1 px-2 text-center font-medium w-14"
              >
                {rank >= 0 ? `+${rank}` : rank}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {talentIds.map((id) => (
            <tr
              key={id}
              className="border-b border-surface-border/40 hover:bg-surface-sidebar/40"
            >
              <td className="py-1 pr-3 align-middle">
                {labelMap[id] || id}
              </td>
              {ranks.map((_, idx) => {
                const checked = normalized[idx] === id;
                const takenElsewhere =
                  !checked &&
                  normalized.some((pick, i) => i !== idx && pick === id);
                return (
                  <td
                    key={`${choiceKey}-${id}-${idx}`}
                    className="py-1 px-2 text-center align-middle"
                  >
                    <input
                      type="radio"
                      name={`${choiceKey}-rank-${idx}`}
                      className="rounded-full"
                      checked={checked}
                      disabled={takenElsewhere}
                      title={
                        takenElsewhere
                          ? "Already assigned to another bonus column"
                          : undefined
                      }
                      onChange={() => {
                        onChange(
                          assignOpenPick(normalized, idx, id, ranks.length)
                        );
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
