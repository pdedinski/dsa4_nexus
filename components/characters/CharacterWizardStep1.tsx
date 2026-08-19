"use client";

import { useEffect, useMemo, useState } from "react";
import racesData from "@/data/core/races.json";
import culturesData from "@/data/core/cultures.json";
import professionsData from "@/data/core/professions.json";
import type { GenerateCharacterInput } from "@/lib/character/types";
import {
  needsSpellSelectionStep,
  satisfiesProfessionRaceRequirement,
} from "@/lib/character/generator";
import {
  DEFAULT_AP_PROFILE_ID,
  defaultApProfileIdForProfession,
} from "@/lib/character/apProfiles";
import BodyPortal from "@/components/ui/BodyPortal";

const CATEGORY_LABELS: Record<string, string> = {
  combat: "Combat",
  traveling_wilderness: "Traveling & Wilderness",
  social: "Socially Oriented",
  craft_knowledge: "Craft & Knowledge",
  magical: "Magical",
  divine_animistic: "Divine & Animistic",
};

const CATEGORY_ORDER = [
  "combat",
  "traveling_wilderness",
  "social",
  "craft_knowledge",
  "magical",
  "divine_animistic",
];

function raceAllowsCulture(raceId: string, cultureId: string) {
  const race = racesData.races.find((r) => r.id === raceId);
  if (!race) return false;
  return race.allowed_cultures
    .flatMap((c) =>
      c === "novadis" ? ["novadis_men", "novadis_women"] : [c]
    )
    .includes(cultureId);
}

function cultureAllowsRace(cultureId: string, raceId: string) {
  const c = culturesData.cultures.find((x) => x.id === cultureId);
  return c?.allowed_races.includes(raceId) ?? false;
}

function cultureAllowsProfession(cultureId: string, professionId: string) {
  const c = culturesData.cultures.find((x) => x.id === cultureId);
  return c?.allowed_professions.includes(professionId) ?? false;
}

function professionAllowedForRace(professionId: string, raceId: string) {
  const p = professionsData.professions.find((x) => x.id === professionId);
  if (!p) return false;
  const rr = p.requirements.find(
    (r): r is { type: "race"; race: string } => r.type === "race"
  );
  if (rr && !satisfiesProfessionRaceRequirement(rr.race, raceId)) return false;
  return true;
}

type ProfessionRow = (typeof professionsData.professions)[number] & {
  category?: string;
  variants?: unknown[];
  selectable?: boolean;
};

function isProfessionSelectable(p: ProfessionRow): boolean {
  return p.selectable !== false;
}

type ApProfileOption = {
  id: string;
  name: string;
  isBuiltin?: boolean;
};

export default function CharacterWizardStep1({
  open,
  onClose,
  onNext,
}: {
  open: boolean;
  onClose: () => void;
  onNext: (payload: GenerateCharacterInput & { needsSpells: boolean }) => void;
}) {
  const [raceId, setRaceId] = useState<string>("random");
  const [cultureId, setCultureId] = useState<string>("random");
  const [professionId, setProfessionId] = useState<string>("random");
  const [professionVariantId, setProfessionVariantId] = useState<string>("base");
  const [gender, setGender] = useState<"random" | "male" | "female">("random");
  const [extraAp, setExtraAp] = useState(0);
  const [halfElfFullCaster, setHalfElfFullCaster] = useState(false);
  const [apProfileId, setApProfileId] = useState(DEFAULT_AP_PROFILE_ID);
  const [apProfileOptions, setApProfileOptions] = useState<ApProfileOption[]>([
    { id: DEFAULT_AP_PROFILE_ID, name: "Default", isBuiltin: true },
  ]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/ap-profiles");
        const data = (await res.json().catch(() => ({}))) as {
          profiles?: ApProfileOption[];
        };
        if (cancelled) return;
        const list = Array.isArray(data.profiles)
          ? data.profiles.filter((p): p is ApProfileOption => Boolean(p?.id))
          : [];
        if (list.length) setApProfileOptions(list);
        setApProfileId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : DEFAULT_AP_PROFILE_ID
        );
      } catch {
        /* keep built-in defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const cultures = useMemo(() => {
    if (raceId === "random") return culturesData.cultures;
    return culturesData.cultures.filter(
      (c) => raceAllowsCulture(raceId, c.id) && cultureAllowsRace(c.id, raceId)
    );
  }, [raceId]);

  const professions = useMemo(() => {
    const all = (professionsData.professions as ProfessionRow[]).filter(
      isProfessionSelectable
    );
    if (cultureId === "random" || raceId === "random") return all;
    return all.filter(
      (p) =>
        cultureAllowsProfession(cultureId, p.id) &&
        professionAllowedForRace(p.id, raceId)
    );
  }, [cultureId, raceId]);

  const professionsByCategory = useMemo(() => {
    const groups = new Map<string, ProfessionRow[]>();
    for (const p of professions) {
      const cat = p.category || "other";
      const list = groups.get(cat) ?? [];
      list.push(p);
      groups.set(cat, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    const ordered: { category: string; label: string; items: ProfessionRow[] }[] =
      [];
    for (const cat of CATEGORY_ORDER) {
      const items = groups.get(cat);
      if (items?.length) {
        ordered.push({
          category: cat,
          label: CATEGORY_LABELS[cat] ?? cat,
          items,
        });
        groups.delete(cat);
      }
    }
    for (const [cat, items] of groups) {
      if (items.length) {
        ordered.push({
          category: cat,
          label: CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " "),
          items,
        });
      }
    }
    return ordered;
  }, [professions]);

  const selectedProfession = useMemo(
    () =>
      (professionsData.professions as ProfessionRow[]).find(
        (p) => p.id === professionId
      ),
    [professionId]
  );
  const variants = Array.isArray(selectedProfession?.variants)
    ? selectedProfession!.variants!
    : [];
  const showVariantSelect = variants.length > 0;

  if (!open) return null;

  const allPicked =
    raceId !== "random" &&
    cultureId !== "random" &&
    professionId !== "random";
  const needsSpells =
    allPicked &&
    needsSpellSelectionStep(raceId, professionId, halfElfFullCaster);

  function submit() {
    onNext({
      raceId: raceId === "random" ? "random" : raceId,
      cultureId: cultureId === "random" ? "random" : cultureId,
      professionId: professionId === "random" ? "random" : professionId,
      professionVariantId:
        professionVariantId === "base" ? "base" : professionVariantId,
      gender,
      extraAp,
      halfElfFullCaster: raceId === "half_elf" ? halfElfFullCaster : false,
      apProfileId,
      needsSpells,
    });
  }

  return (
    <BodyPortal>
      <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="relative z-[1] max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-surface-border bg-surface-card p-5 shadow-2xl ring-1 ring-black/40">
          <h2 className="text-lg font-bold text-ink mb-4">Create a new hero</h2>
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-ink-muted">Race</span>
              <select
                className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
                value={raceId}
                onChange={(e) => {
                  setRaceId(e.target.value);
                  setCultureId("random");
                  setProfessionId("random");
                  setProfessionVariantId("base");
                  setApProfileId(defaultApProfileIdForProfession("random"));
                }}
              >
                <option value="random">Random</option>
                {racesData.races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-ink-muted">Culture</span>
              <select
                className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
                value={cultureId}
                onChange={(e) => {
                  setCultureId(e.target.value);
                  setProfessionId("random");
                  setProfessionVariantId("base");
                  setApProfileId(defaultApProfileIdForProfession("random"));
                }}
              >
                <option value="random">Random</option>
                {cultures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-ink-muted">Profession</span>
              <select
                className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
                value={professionId}
                onChange={(e) => {
                  const next = e.target.value;
                  setProfessionId(next);
                  setProfessionVariantId("base");
                  setApProfileId(defaultApProfileIdForProfession(next));
                }}
              >
                <option value="random">Random</option>
                {professionsByCategory.map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.items.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {showVariantSelect && (
              <label className="block">
                <span className="text-ink-muted">Profession variant</span>
                <select
                  className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
                  value={professionVariantId}
                  onChange={(e) => setProfessionVariantId(e.target.value)}
                >
                  <option value="base">Base</option>
                  {(variants as Array<{ id?: string; name?: string }>).map(
                    (v, i) => (
                      <option key={v.id ?? String(i)} value={v.id ?? "base"}>
                        {v.name ?? v.id ?? `Variant ${i + 1}`}
                      </option>
                    )
                  )}
                </select>
              </label>
            )}
            {!showVariantSelect && professionId !== "random" && (
              <p className="text-xs text-ink-faint">
                Variant: Base (academy/unit variants come in a later data pass)
              </p>
            )}
            <label className="block">
              <span className="text-ink-muted">Gender</span>
              <select
                className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as "random" | "male" | "female")
                }
              >
                <option value="random">Random</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
            {raceId === "half_elf" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={halfElfFullCaster}
                  onChange={(e) => setHalfElfFullCaster(e.target.checked)}
                />
                <span className="text-ink-muted">
                  Half-Elf: elvish upbringing (full caster, +8 GP)
                </span>
              </label>
            )}
            <label className="block">
              <span className="text-ink-muted">
                Extra AP (veteran) — boosts existing talents and spell skill
                ratings using the advancement-column costs; spell share follows
                profession weight and spell priorities.
              </span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded border border-surface-border bg-surface-sidebar px-2 py-2 text-ink"
                value={extraAp}
                onChange={(e) => setExtraAp(Number(e.target.value) || 0)}
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Veteran AP spending profile</span>
              <select
                className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
                value={
                  apProfileOptions.some((p) => p.id === apProfileId)
                    ? apProfileId
                    : DEFAULT_AP_PROFILE_ID
                }
                onChange={(e) => setApProfileId(e.target.value)}
              >
                {apProfileOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isBuiltin ? " (built-in)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-surface-sidebar"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium"
              onClick={submit}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
