"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bug } from "lucide-react";
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
import DebugLogModal from "./DebugLogModal";
import { postGenerateSheet } from "./postGenerateSheet";
import { DEBUG_MODE_CHANGED_EVENT } from "@/components/manage/ManageSettingsClient";

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
  const [wipBuyArmorUseSa, setWipBuyArmorUseSa] = useState(false);
  const [preview, setPreview] = useState<CharacterSheet | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewName, setPreviewName] = useState("");
  const [nameEditMode, setNameEditMode] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [lastGenInput, setLastGenInput] =
    useState<GenerateCharacterInput | null>(null);
  const [lastGenPriorities, setLastGenPriorities] = useState<
    Record<string, SpellPriority> | undefined
  >();
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [debugLocalPreference, setDebugLocalPreference] = useState(false);
  const [debugLogOpen, setDebugLogOpen] = useState(false);

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
    void (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = (await res.json()) as { user?: { isSuperuser?: boolean } };
        setIsSuperuser(Boolean(data?.user?.isSuperuser));
      } catch {
        setIsSuperuser(false);
      }
    })();
  }, []);

  useEffect(() => {
    const readPreference = () => {
      try {
        setDebugLocalPreference(localStorage.getItem("dsa_debug_mode") === "1");
      } catch {
        setDebugLocalPreference(false);
      }
    };
    readPreference();
    const onVis = () => {
      if (document.visibilityState === "visible") readPreference();
    };
    window.addEventListener(DEBUG_MODE_CHANGED_EVENT, readPreference);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(DEBUG_MODE_CHANGED_EVENT, readPreference);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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
      const debugModePayload = isSuperuser && debugLocalPreference;
      const sheet = await postGenerateSheet({
        input,
        spellPriorities: priorities,
        debugMode: debugModePayload,
      });
      setLastGenInput(input);
      setLastGenPriorities(priorities);
      setPreview(sheet);
      setPreviewName(sheet.header.displayName);
      setNameEditMode(false);
      setDebugLogOpen(false);
      setPreviewOpen(true);
      setWizard1(false);
      setWizard2(false);
      setWizardWeapons(false);
      setWizardArmor(false);
      setGenInput(null);
      setSpellPriorities(undefined);
      setWipWeaponIds([]);
      setWipArmorIds([]);
      setWipBuyArmorUseSa(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Generate failed");
    }
    setGenerating(false);
  }

  async function rerollName() {
    if (!lastGenInput) return;
    setRerolling(true);
    try {
      const debugModePayload = isSuperuser && debugLocalPreference;
      const sheet = await postGenerateSheet({
        input: lastGenInput,
        spellPriorities: lastGenPriorities,
        debugMode: debugModePayload,
      });
      const newName = sheet.header.displayName;
      setPreviewName(newName);
      setPreview((p) =>
        p ? { ...p, header: { ...p.header, displayName: newName } } : null
      );
      setNameEditMode(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Reroll name failed");
    }
    setRerolling(false);
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
          New hero
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
          setWipBuyArmorUseSa(false);
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
          setWipBuyArmorUseSa(false);
        }}
        onBack={() => {
          setWizardWeapons(false);
          if (needsSpellsFlag) setWizard2(true);
          else setWizard1(true);
        }}
        onNext={() => {
          setWipArmorIds([]);
          setWipBuyArmorUseSa(false);
          setWizardWeapons(false);
          setWizardArmor(true);
        }}
      />

      <CharacterWizardStepArmor
        open={wizardArmor && Boolean(genInput)}
        selectedIds={wipArmorIds}
        onSelectedIdsChange={setWipArmorIds}
        buyArmorUseSa={wipBuyArmorUseSa}
        onBuyArmorUseSaChange={setWipBuyArmorUseSa}
        onCancel={() => {
          setWizardArmor(false);
          setWizardWeapons(false);
          setGenInput(null);
          setSpellPriorities(undefined);
          setWipWeaponIds([]);
          setWipArmorIds([]);
          setWipBuyArmorUseSa(false);
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
              buyArmorUseSa: wipBuyArmorUseSa || undefined,
            },
            spellPriorities
          );
        }}
      />

      {previewOpen && preview && (
        <BodyPortal>
          <div className="fixed inset-0 z-[200] flex flex-col bg-[#1a1410]">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-surface-card px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                <h2 className="shrink-0 font-bold text-ink">Preview</h2>
                {nameEditMode ? (
                  <>
                    <input
                      type="text"
                      value={previewName}
                      onChange={(e) => setPreviewName(e.target.value)}
                      className="min-w-[12rem] max-w-md flex-1 rounded-lg border border-surface-border bg-[#2c251f] px-3 py-1.5 text-sm text-[#f2e8dc]"
                      autoFocus
                      aria-label="Character name"
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
                      onClick={() => {
                        const trimmed = previewName.trim();
                        if (trimmed) {
                          setPreviewName(trimmed);
                          setPreview((p) =>
                            p
                              ? {
                                  ...p,
                                  header: {
                                    ...p.header,
                                    displayName: trimmed,
                                  },
                                }
                              : null
                          );
                        }
                        setNameEditMode(false);
                      }}
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 truncate text-sm font-medium text-ink">
                      {previewName || preview.header.displayName}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-surface-border px-3 py-1.5 text-sm text-ink hover:bg-surface-sidebar"
                      onClick={() => setNameEditMode(true)}
                    >
                      Edit name
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {isSuperuser &&
                  debugLocalPreference &&
                  preview.debugLog &&
                  preview.debugLog.length > 0 && (
                    <button
                      type="button"
                      title="Open generation debug trace"
                      aria-label="Open generation debug trace"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-800/70 bg-amber-950/40 text-amber-400 hover:bg-amber-950/70"
                      onClick={() => setDebugLogOpen(true)}
                    >
                      <Bug className="h-4 w-4" />
                    </button>
                  )}
                <button
                  type="button"
                  disabled={rerolling || generating || !lastGenInput}
                  className="px-3 py-1.5 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar disabled:opacity-50"
                  onClick={() => void rerollName()}
                >
                  Reroll name
                </button>
                <button
                  type="button"
                  disabled={generating || rerolling || !lastGenInput}
                  className="px-3 py-1.5 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar disabled:opacity-50"
                  onClick={() => {
                    if (!lastGenInput) return;
                    void runGenerate(lastGenInput, lastGenPriorities);
                  }}
                >
                  Reroll
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg text-sm bg-brand text-white"
                  onClick={() => {
                    const trimmed =
                      previewName.trim() || preview.header.displayName;
                    setPreviewName(trimmed);
                    setPreview((p) =>
                      p
                        ? {
                            ...p,
                            header: { ...p.header, displayName: trimmed },
                          }
                        : null
                    );
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
                    setLastGenInput(null);
                    setLastGenPriorities(undefined);
                    setPreviewName("");
                    setNameEditMode(false);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <CharacterSheetView
                sheet={{
                  ...preview,
                  header: {
                    ...preview.header,
                    displayName:
                      previewName.trim() || preview.header.displayName,
                  },
                }}
              />
            </div>
          </div>
        </BodyPortal>
      )}

      {debugLogOpen && preview?.debugLog && preview.debugLog.length > 0 && (
        <BodyPortal>
          <DebugLogModal
            lines={preview.debugLog}
            onClose={() => setDebugLogOpen(false)}
          />
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
          setLastGenInput(null);
          setLastGenPriorities(undefined);
          setPreviewName("");
          setNameEditMode(false);
          load();
          router.push(`/characters/${encodeURIComponent(cid)}`);
        }}
      />
    </div>
  );
}
