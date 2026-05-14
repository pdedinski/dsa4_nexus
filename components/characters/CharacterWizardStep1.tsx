"use client";

import { useEffect, useMemo, useState } from "react";
import racesData from "@/data/core/races.json";
import culturesData from "@/data/core/cultures.json";
import professionsData from "@/data/core/professions.json";
import conceptWeights from "@/data/concepts/concept_weights.json";
import type { ConceptId } from "@/lib/character/types";
import type { GenerateCharacterInput } from "@/lib/character/types";
import {
  needsSpellSelectionStep,
  satisfiesProfessionRaceRequirement,
} from "@/lib/character/generator";
import { DEFAULT_AP_PROFILE_ID } from "@/lib/character/apProfiles";
import BodyPortal from "@/components/ui/BodyPortal";

function raceAllowsCulture(raceId: string, cultureId: string) {
  const race = racesData.races.find((r) => r.id === raceId);
  if (!race) return false;
  return race.allowed_cultures.flatMap((c) =>
    c === "novadis" ? ["novadis_men", "novadis_women"] : [c]
  ).includes(cultureId);
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

const CONCEPT_IDS = (Object.keys(conceptWeights.concepts) as ConceptId[]).filter(
  (c) => c !== "any"
);

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
  const [conceptId, setConceptId] = useState<string>("random");
  const [raceId, setRaceId] = useState<string>("random");
  const [cultureId, setCultureId] = useState<string>("random");
  const [professionId, setProfessionId] = useState<string>("random");
  const [gender, setGender] = useState<"random" | "male" | "female">("random");
  const [extraAp, setExtraAp] = useState(0);
  const [halfElfFullCaster, setHalfElfFullCaster] = useState(false);
  const [apProfileId, setApProfileId] = useState(DEFAULT_AP_PROFILE_ID);
  const [apProfileOptions, setApProfileOptions] = useState<ApProfileOption[]>(
    [{ id: DEFAULT_AP_PROFILE_ID, name: "Default", isBuiltin: true }],
  );

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
          prev && list.some((p) => p.id === prev) ? prev : DEFAULT_AP_PROFILE_ID,
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
    if (cultureId === "random" || raceId === "random")
      return professionsData.professions;
    return professionsData.professions.filter(
      (p) =>
        cultureAllowsProfession(cultureId, p.id) &&
        professionAllowedForRace(p.id, raceId)
    );
  }, [cultureId, raceId]);

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
      conceptId: (conceptId === "random" ? "random" : conceptId) as GenerateCharacterInput["conceptId"],
      raceId: raceId === "random" ? "random" : raceId,
      cultureId: cultureId === "random" ? "random" : cultureId,
      professionId: professionId === "random" ? "random" : professionId,
      gender,
      extraAp,
      halfElfFullCaster:
        raceId === "half_elf" ? halfElfFullCaster : false,
      apProfileId,
      needsSpells,
    });
  }

  return (
    <BodyPortal>
    <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface-card border border-surface-border rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5">
        <h2 className="text-lg font-bold text-ink mb-4">New random character</h2>
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="text-ink-muted">Concept</span>
            <select
              className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
            >
              <option value="random">Random</option>
              {CONCEPT_IDS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-ink-muted">Race</span>
            <select
              className="mt-1 w-full rounded border border-surface-border px-2 py-2 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
              value={raceId}
              onChange={(e) => {
                setRaceId(e.target.value);
                setCultureId("random");
                setProfessionId("random");
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
              onChange={(e) => setProfessionId(e.target.value)}
            >
              <option value="random">Random</option>
              {professions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
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
              Extra AP (veteran) — raises talents and spell ZfW already on this
              sheet (SKT step costs; spell share by concept weight and spell
              priorities)
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
            Next step
          </button>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}
