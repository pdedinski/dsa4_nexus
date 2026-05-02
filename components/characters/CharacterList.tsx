"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CharacterSheet } from "@/lib/character/types";
import type { GenerateCharacterInput } from "@/lib/character/types";
import type { SpellPriority } from "@/lib/character/types";
import CharacterSheetView from "./CharacterSheet";
import CharacterWizardStep1 from "./CharacterWizardStep1";
import CharacterWizardStep2 from "./CharacterWizardStep2";
import CharacterWizardStepWeapons from "./CharacterWizardStepWeapons";
import CharacterWizardStepArmor from "./CharacterWizardStepArmor";
import SaveCharacterDialog from "./SaveCharacterDialog";
import BodyPortal from "@/components/ui/BodyPortal";

type Row = {
  id: string;
  characterId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export default function CharacterList() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [sort, setSort] = useState<"name" | "created">("created");
  const [loading, setLoading] = useState(true);
  const [wizard1, setWizard1] = useState(false);
  const [wizard2, setWizard2] = useState(false);
  const [wizardWeapons, setWizardWeapons] = useState(false);
  const [wizardArmor, setWizardArmor] = useState(false);
  const [genInput, setGenInput] = useState<GenerateCharacterInput | null>(null);
  const [needsSpellsFlag, setNeedsSpellsFlag] = useState(false);
  const [spellPriorities, setSpellPriorities] = useState<
    Record<string, SpellPriority> | undefined
  >();
  const [wipWeaponIds, setWipWeaponIds] = useState<string[]>([]);
  const [wipArmorIds, setWipArmorIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<CharacterSheet | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/characters?sort=${sort}`);
    const data = await res.json();
    setRows(data.characters ?? []);
    setLoading(false);
  }, [sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!previewOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [previewOpen]);

  async function runGenerate(
    input: GenerateCharacterInput,
    priorities?: Record<string, SpellPriority>
  ) {
    setGenerating(true);
    try {
      const res = await fetch("/api/characters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, spellPriorities: priorities }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generate failed");
      setPreview(data.sheet);
      setPreviewOpen(true);
      setWizard1(false);
      setWizard2(false);
      setWizardWeapons(false);
      setWizardArmor(false);
      setGenInput(null);
      setSpellPriorities(undefined);
      setWipWeaponIds([]);
      setWipArmorIds([]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Generate failed");
    }
    setGenerating(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          type="button"
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50"
          onClick={() => setWizard1(true)}
        >
          New random character
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">Sort:</span>
          <select
            className="rounded border border-surface-border px-2 py-1 scheme-dark bg-[#2c251f] text-[#f2e8dc]"
            value={sort}
            onChange={(e) => setSort(e.target.value as "name" | "created")}
          >
            <option value="created">Date created</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-ink-muted text-sm">Loading…</p>
      ) : rows.length === 0 && !previewOpen ? (
        <p className="text-ink-muted text-sm">No saved characters yet.</p>
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full text-sm text-left">
            <thead className="bg-surface-sidebar text-ink-muted uppercase text-xs">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-surface-border hover:bg-surface-sidebar/50"
                >
                  <td className="px-3 py-2 font-medium text-ink">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.characterId}</td>
                  <td className="px-3 py-2 text-ink-muted text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <Link
                      href={`/characters/${encodeURIComponent(r.characterId)}`}
                      className="text-brand font-medium"
                    >
                      View
                    </Link>
                    <Link
                      href={`/characters/${encodeURIComponent(r.characterId)}/edit`}
                      className="text-ink-muted hover:text-ink"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className="text-red-600 dark:text-red-400"
                      onClick={async () => {
                        if (!confirm(`Delete ${r.name} (${r.characterId})?`))
                          return;
                        await fetch(
                          `/api/characters/${encodeURIComponent(r.characterId)}`,
                          { method: "DELETE" }
                        );
                        load();
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <CharacterWizardStep1
        open={wizard1}
        onClose={() => setWizard1(false)}
        onNext={(payload) => {
          const { needsSpells, ...rest } = payload as GenerateCharacterInput & {
            needsSpells: boolean;
          };
          setGenInput(rest);
          setNeedsSpellsFlag(needsSpells);
          setSpellPriorities(undefined);
          setWipWeaponIds([]);
          setWipArmorIds([]);
          setWizard1(false);
          if (needsSpells) {
            setWizard2(true);
          } else {
            setWizardWeapons(true);
          }
        }}
      />

      {genInput &&
        genInput.raceId !== "random" &&
        genInput.professionId !== "random" && (
          <CharacterWizardStep2
            open={wizard2 && needsSpellsFlag}
            raceId={genInput.raceId}
            professionId={genInput.professionId}
            halfElfFullCaster={Boolean(genInput.halfElfFullCaster)}
            onBack={() => {
              setWizard2(false);
              setWizard1(true);
            }}
            onCancel={() => {
              setWizard2(false);
              setGenInput(null);
              setSpellPriorities(undefined);
            }}
            onContinue={(priorities) => {
              setSpellPriorities(priorities);
              setWizard2(false);
              setWizardWeapons(true);
            }}
          />
        )}

      <CharacterWizardStepWeapons
        open={wizardWeapons && Boolean(genInput)}
        selectedIds={wipWeaponIds}
        onSelectedIdsChange={setWipWeaponIds}
        onCancel={() => {
          setWizardWeapons(false);
          setGenInput(null);
          setSpellPriorities(undefined);
          setWipWeaponIds([]);
          setWipArmorIds([]);
        }}
        onBack={() => {
          setWizardWeapons(false);
          if (needsSpellsFlag) setWizard2(true);
          else setWizard1(true);
        }}
        onNext={() => {
          setWipArmorIds([]);
          setWizardWeapons(false);
          setWizardArmor(true);
        }}
      />

      <CharacterWizardStepArmor
        open={wizardArmor && Boolean(genInput)}
        selectedIds={wipArmorIds}
        onSelectedIdsChange={setWipArmorIds}
        onCancel={() => {
          setWizardArmor(false);
          setWizardWeapons(false);
          setGenInput(null);
          setSpellPriorities(undefined);
          setWipWeaponIds([]);
          setWipArmorIds([]);
        }}
        onBack={() => {
          setWizardArmor(false);
          setWizardWeapons(true);
        }}
        onGenerate={() => {
          if (!genInput) return;
          void runGenerate(
            {
              ...genInput,
              weaponIds: wipWeaponIds.length ? wipWeaponIds : undefined,
              armorIds: wipArmorIds.length ? wipArmorIds : undefined,
            },
            spellPriorities
          );
        }}
      />

      {previewOpen && preview && (
        <BodyPortal>
          <div className="fixed inset-0 z-[200] flex flex-col bg-[#1a1410]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
              <h2 className="font-bold text-ink">Preview</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-sm bg-brand text-white"
                  onClick={() => {
                    setSaveOpen(true);
                  }}
                >
                  Save character
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar"
                  onClick={() => {
                    setPreview(null);
                    setPreviewOpen(false);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <CharacterSheetView sheet={preview} />
            </div>
          </div>
        </BodyPortal>
      )}

      <SaveCharacterDialog
        open={saveOpen}
        sheet={preview}
        onClose={() => setSaveOpen(false)}
        onSaved={(cid) => {
          setSaveOpen(false);
          setPreviewOpen(false);
          setPreview(null);
          load();
          router.push(`/characters/${encodeURIComponent(cid)}`);
        }}
      />
    </div>
  );
}
