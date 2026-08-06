"use client";

import type {
  Konflikt,
  KonfliktSection,
} from "@/lib/chargen/rules/voraussetzungen";

const SECTION_ORDER: { id: KonfliktSection; label: string }[] = [
  { id: "budget", label: "Budget" },
  { id: "race", label: "Race" },
  { id: "culture", label: "Culture" },
  { id: "profession", label: "Profession" },
  { id: "attributes", label: "Attributes" },
  { id: "talents", label: "Talents" },
  { id: "spells", label: "Spells" },
  { id: "special_abilities", label: "Special Abilities" },
  { id: "traits", label: "Advantages / Disadvantages" },
  { id: "general", label: "General" },
];

const SF_PREREQ_REMARK =
  "Remark: Requirements of Special Abilities don't have to be fulfilled to select the ability but to use the ability.";

function groupConflicts(conflicts: Konflikt[]): {
  id: KonfliktSection;
  label: string;
  items: Konflikt[];
}[] {
  const buckets = new Map<KonfliktSection, Konflikt[]>();
  for (const c of conflicts) {
    const section = c.section || "general";
    if (!buckets.has(section)) buckets.set(section, []);
    buckets.get(section)!.push(c);
  }
  const groups = SECTION_ORDER.filter((s) => (buckets.get(s.id)?.length ?? 0) > 0).map(
    (s) => ({
      id: s.id,
      label: s.label,
      items: buckets.get(s.id)!,
    })
  );
  for (const [id, items] of buckets) {
    if (!SECTION_ORDER.some((s) => s.id === id)) {
      groups.push({ id, label: id, items });
    }
  }
  return groups;
}

export default function ProblemsPanel({
  conflicts,
  canFinish,
  advisoryMode,
  hasSpecialAbilityPrereqIssues,
}: {
  conflicts: Konflikt[];
  canFinish: boolean;
  advisoryMode?: boolean;
  hasSpecialAbilityPrereqIssues?: boolean;
}) {
  if (!conflicts.length) {
    return (
      <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-4 text-sm text-emerald-200">
        No problems detected. You can finish this hero.
      </div>
    );
  }

  const groups = groupConflicts(conflicts);
  const showSfRemark =
    hasSpecialAbilityPrereqIssues ||
    conflicts.some((c) => c.section === "special_abilities");

  return (
    <div className="space-y-3">
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
      {groups.map((g) => (
        <section key={g.id} className="space-y-1.5">
          <h3 className="text-sm font-semibold text-ink underline underline-offset-2">
            {g.label}
          </h3>
          <ul className="space-y-1.5">
            {g.items.map((c) => (
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
        </section>
      ))}
      {showSfRemark ? (
        <p className="text-xs text-ink-muted border-t border-surface-border pt-2">
          {SF_PREREQ_REMARK}
        </p>
      ) : null}
    </div>
  );
}
