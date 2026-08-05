/**
 * Open fixed talent bonus picks — one talent per rank, no duplicates across ranks.
 * Mirrors Java `PanelTalentBonusFest` radio-column groups.
 */

export function normalizeOpenPicks(
  picks: string[] | undefined,
  rankCount: number
): string[] {
  const out = [...(picks || [])];
  while (out.length < rankCount) out.push("");
  return out.slice(0, rankCount);
}

/** Talent ids already chosen in sibling rank slots. */
export function siblingPicks(
  picks: string[],
  excludeIdx: number
): Set<string> {
  const used = new Set<string>();
  picks.forEach((id, i) => {
    if (i !== excludeIdx && id) used.add(id);
  });
  return used;
}

export function availableForRank(
  choiceTalents: string[],
  picks: string[],
  rankIdx: number
): string[] {
  const used = siblingPicks(picks, rankIdx);
  const current = picks[rankIdx] || "";
  return choiceTalents.filter((id) => !used.has(id) || id === current);
}

/** Assign a talent to one rank; clears that talent from other ranks in the group. */
export function assignOpenPick(
  picks: string[],
  rankIdx: number,
  talentId: string,
  rankCount: number
): string[] {
  const next = normalizeOpenPicks(picks, rankCount);
  for (let i = 0; i < next.length; i++) {
    if (i !== rankIdx && next[i] === talentId) next[i] = "";
  }
  next[rankIdx] = talentId;
  return next;
}

export function clearOpenPick(
  picks: string[],
  rankIdx: number,
  rankCount: number
): string[] {
  const next = normalizeOpenPicks(picks, rankCount);
  next[rankIdx] = "";
  return next;
}
