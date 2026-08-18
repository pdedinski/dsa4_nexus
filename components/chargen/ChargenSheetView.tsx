"use client";

/* Sheet must always re-render from the live HeldModel after edits. */
"use no memo";

import { useMemo, useState, type ReactNode } from "react";
import type { HeldModel } from "@/lib/chargen/types";
import {
  ATTR_LABELS,
  attributeModsSum,
  currentAttrValue,
  derivedValue,
  type AttributeMods,
} from "@/lib/chargen/types";
import talenteCatalog from "@/lib/chargen/data/talente.json";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import { formatTalentProbe } from "@/lib/chargen/rules/talentCaps";
import { formatOwnedTraitName } from "@/lib/chargen/rules/traitLabels";
import {
  sheetSpellNamePrefix,
  sheetTalentLeadPrefix,
} from "@/lib/chargen/export/sheetDocument";
import { sktColumnLabel } from "@/lib/chargen/rules/kosten";
import { resolveTalentSktColumn } from "@/lib/chargen/rules/sktColumn";
import {
  formatHpSt,
  formatWm,
  shieldTypeLabel,
} from "@/lib/chargen/rules/equipmentWert";
import {
  formatDcEnglish,
  formatHpDice,
  formatTypeEec,
  meleeAdjustedHp,
  meleeAttackValue,
  meleeParryValue,
  rangedAttackValue,
  totalArmorEc,
  unarmedAttack,
  unarmedHp,
  unarmedParry,
} from "@/lib/chargen/export/sheetCombat";
import {
  SHEET_GROUP_LABELS,
  SHEET_TALENT_GROUP_ORDER,
  buildSheetDocument,
} from "@/lib/chargen/export/sheetDocument";
import { downloadHeldJson } from "@/lib/chargen/io/exportJson";
import { downloadLegacyHeldXml } from "@/lib/chargen/io/exportLegacyXml";
import { downloadRtf } from "@/lib/chargen/export/toRtf";
import { downloadPdf } from "@/lib/chargen/export/toPdf";
import { downloadDocx } from "@/lib/chargen/export/toDocx";
import waffenNahkampf from "@/lib/chargen/data/waffen_nahkampf.json";
import waffenFernkampf from "@/lib/chargen/data/waffen_fernkampf.json";
import SaveNameConflictDialog from "@/components/chargen/SaveNameConflictDialog";
import {
  findCharacterByName,
  latestVersionOf,
  type GroupedChargenCharacter,
} from "@/lib/chargen/heroesVersioning";

export type PersistMeta = {
  id: string;
  characterId: string;
  version: number;
  updatedAt: string | null;
};

const TALENT_BY_ID = new Map(
  (talenteCatalog as CatalogItem[]).map((t) => [String(t.id), t])
);
const MELEE_CATALOG = new Map(
  (waffenNahkampf as CatalogItem[]).map((w) => [String(w.id), w])
);
const RANGED_CATALOG = new Map(
  (waffenFernkampf as CatalogItem[]).map((w) => [String(w.id), w])
);

const DERIVED_LABELS: Record<string, string> = {
  VP: "Vitality",
  EP: "Endurance",
  RM: "Magic Resistance",
  ASP: "Astral Energy",
  WT: "Wound Threshold",
  baseAT: "Base Attack",
  basePA: "Base Parry",
  baseBRV: "Base Ranged",
  baseINI: "Base Initiative",
  GS: "Speed",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 border border-surface-border rounded-lg overflow-hidden bg-surface-card">
      <h3 className="text-sm font-bold uppercase tracking-wide bg-brand-muted px-3 py-2 text-ink border-b border-surface-border">
        {title}
      </h3>
      <div className="p-3 text-sm text-ink">{children}</div>
    </section>
  );
}

function StatChip({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded border border-surface-border bg-[#1a1410] px-2 py-1.5 min-w-0">
      <div className="text-ink-faint text-[10px] uppercase tracking-wide truncate">
        {label}
      </div>
      <div className="font-semibold text-base tabular-nums leading-tight">
        {value}
      </div>
      {sub != null ? (
        <div className="text-[10px] text-ink-faint mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}

function meleeMains(weaponId: string): string[] {
  const cat = MELEE_CATALOG.get(weaponId);
  if (!cat) return [];
  const talents = cat.talents;
  if (Array.isArray(talents) && talents.length) return talents.map(String);
  if (cat.talent) return [String(cat.talent)];
  return [];
}

function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full min-w-[28rem] text-left text-xs border-collapse">
        {children}
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-surface-border px-1.5 py-1 font-semibold text-ink-muted whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <td className={`border-b border-surface-border/60 px-1.5 py-1 ${className}`}>
      {children}
    </td>
  );
}

export default function ChargenSheetView({
  held,
  labels,
  attributeMods,
  dbHeroId = null,
  dbCharacterId = null,
  dbVersion = null,
  dbUpdatedAt = null,
  onPersisted,
  onHeldNameChange,
  modificationActive = false,
  onFinishCreation,
}: {
  held: HeldModel;
  labels: {
    race?: string;
    culture?: string;
    profession?: string;
    byId: Record<string, string>;
  };
  /** Race/culture/profession attribute modifiers — required for correct Current values. */
  attributeMods?: AttributeMods;
  dbHeroId?: string | null;
  dbCharacterId?: string | null;
  dbVersion?: number | null;
  dbUpdatedAt?: string | null;
  onPersisted?: (meta: PersistMeta) => void;
  onHeldNameChange?: (name: string) => void;
  modificationActive?: boolean;
  onFinishCreation?: () => void;
}) {
  const nameOf = (id: string) => labels.byId[id] || id;
  const baseName = (held.name || "hero").replace(/[^\w\-]+/g, "_");
  const [persistStatus, setPersistStatus] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [finishStatus, setFinishStatus] = useState<string | null>(null);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [conflictMatch, setConflictMatch] =
    useState<GroupedChargenCharacter | null>(null);
  const [renameSuggested, setRenameSuggested] = useState(held.name || "");

  /** Always build from the live held — never cache across edits. */
  function makeDoc() {
    return buildSheetDocument(held, {
      race: labels.race,
      culture: labels.culture,
      profession: labels.profession,
      talentName: nameOf,
      spellName: nameOf,
      traitName: nameOf,
      saName: nameOf,
      attributeMods,
    });
  }

  const talentsByGroup = useMemo(() => {
    const map = new Map<string, typeof held.talents>();
    for (const tw of held.talents) {
      const group = String(TALENT_BY_ID.get(tw.id)?.group || "other");
      const list = map.get(group) ?? [];
      list.push(tw);
      map.set(group, list);
    }
    return map;
  }, [held]);

  const sumEc = totalArmorEc(held);
  const sumAr = held.armors.reduce((s, a) => s + (a.rs ?? 0), 0);
  const bpv = derivedValue(held, "basePA");
  const biv = derivedValue(held, "baseINI");
  const apCredit = Math.max(0, (held.apTotal || 0) - (held.apSpent || 0));

  async function fetchHeroList(): Promise<GroupedChargenCharacter[]> {
    const res = await fetch("/api/chargen/heroes");
    const data = (await res.json()) as {
      heroes?: GroupedChargenCharacter[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error || "Failed to load heroes");
    }
    return data.heroes ?? [];
  }

  function metaFromResponse(body: {
    id: string;
    characterId?: string;
    version?: number;
    updatedAt?: string;
  }): PersistMeta {
    return {
      id: body.id,
      characterId: body.characterId ?? body.id,
      version: body.version ?? 1,
      updatedAt: body.updatedAt ?? null,
    };
  }

  async function putVersion(
    heroId: string,
    data: HeldModel
  ): Promise<{ ok: true; meta: PersistMeta } | { ok: false; error: string; status: number }> {
    const putRes = await fetch(`/api/chargen/heroes/${heroId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (putRes.ok) {
      const body = (await putRes.json()) as {
        id: string;
        characterId?: string;
        version?: number;
        updatedAt?: string;
      };
      return { ok: true, meta: metaFromResponse(body) };
    }
    const body = (await putRes.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error || "Failed to update hero.",
      status: putRes.status,
    };
  }

  async function postHero(
    data: HeldModel,
    characterId?: string
  ): Promise<{ ok: true; meta: PersistMeta } | { ok: false; error: string; status: number }> {
    const postRes = await fetch("/api/chargen/heroes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        characterId ? { data, characterId } : { data }
      ),
    });
    if (postRes.ok) {
      const body = (await postRes.json()) as {
        id: string;
        characterId?: string;
        version?: number;
        updatedAt?: string;
      };
      return { ok: true, meta: metaFromResponse(body) };
    }
    const body = (await postRes.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error || "Failed to save hero.",
      status: postRes.status,
    };
  }

  async function saveUnlinkedWithNameCheck(data: HeldModel): Promise<void> {
    const list = await fetchHeroList();
    const match = findCharacterByName(list, data.name || "");
    if (!match) {
      const created = await postHero(data);
      if (!created.ok) {
        setPersistStatus(created.error);
        return;
      }
      onPersisted?.(created.meta);
      setPersistStatus("Saved to database.");
      return;
    }
    setConflictMatch(match);
    setRenameSuggested(data.name || "");
    setConflictError(null);
    setConflictOpen(true);
  }

  async function persistToDatabase() {
    if (!onPersisted) return;
    setPersisting(true);
    setPersistStatus(null);
    try {
      if (dbHeroId) {
        const put = await putVersion(dbHeroId, held);
        if (put.ok) {
          onPersisted(put.meta);
          setPersistStatus("Saved to database.");
          return;
        }
        if (put.status !== 403) {
          setPersistStatus(put.error);
          return;
        }
        await saveUnlinkedWithNameCheck(held);
        return;
      }

      await saveUnlinkedWithNameCheck(held);
    } catch {
      setPersistStatus("Failed to save hero.");
    } finally {
      setPersisting(false);
    }
  }

  async function persistNewVersion() {
    if (!onPersisted || !dbCharacterId) return;
    setPersisting(true);
    setPersistStatus(null);
    try {
      const created = await postHero(held, dbCharacterId);
      if (!created.ok) {
        setPersistStatus(created.error);
        return;
      }
      onPersisted(created.meta);
      setPersistStatus(`Saved as version ${created.meta.version}.`);
    } catch {
      setPersistStatus("Failed to save new version.");
    } finally {
      setPersisting(false);
    }
  }

  async function handleConflictChoice(
    choice:
      | { action: "overwrite" }
      | { action: "newVersion" }
      | { action: "newCharacter"; name: string }
  ) {
    if (!onPersisted || !conflictMatch) return;
    setPersisting(true);
    setConflictError(null);
    try {
      if (choice.action === "overwrite") {
        const latest = latestVersionOf(conflictMatch);
        const put = await putVersion(latest.id, held);
        if (!put.ok) {
          setConflictError(put.error);
          return;
        }
        onPersisted(put.meta);
        setConflictOpen(false);
        setConflictMatch(null);
        setPersistStatus("Overwrote latest version.");
        return;
      }
      if (choice.action === "newVersion") {
        const created = await postHero(held, conflictMatch.characterId);
        if (!created.ok) {
          setConflictError(created.error);
          return;
        }
        onPersisted(created.meta);
        setConflictOpen(false);
        setConflictMatch(null);
        setPersistStatus(`Saved as version ${created.meta.version}.`);
        return;
      }

      const renamedHeld = { ...held, name: choice.name };
      onHeldNameChange?.(choice.name);
      const list = await fetchHeroList();
      const again = findCharacterByName(list, choice.name);
      if (again) {
        setConflictMatch(again);
        setRenameSuggested(choice.name);
        setConflictError(
          `A character named “${again.name}” already exists. Choose another option or name.`
        );
        return;
      }
      const created = await postHero(renamedHeld);
      if (!created.ok) {
        setConflictError(created.error);
        return;
      }
      onPersisted(created.meta);
      setConflictOpen(false);
      setConflictMatch(null);
      setPersistStatus("Saved as a new character.");
    } catch {
      setConflictError("Failed to save hero.");
    } finally {
      setPersisting(false);
    }
  }

  function sktFor(talentId: string): string {
    const meta = TALENT_BY_ID.get(talentId);
    if (!meta) return "";
    try {
      return sktColumnLabel(resolveTalentSktColumn(held, meta)).replace(
        /[()]/g,
        ""
      );
    } catch {
      return meta.skt_column != null
        ? sktColumnLabel(meta.skt_column as string | number).replace(/[()]/g, "")
        : "";
    }
  }

  const versionLabel =
    dbVersion != null
      ? `Version ${dbVersion}${
          dbUpdatedAt
            ? ` · Updated ${new Date(dbUpdatedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}`
            : ""
        }`
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium"
          onClick={() => downloadLegacyHeldXml(held, `${baseName}.dcg`)}
        >
          Download .dcg
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar"
          onClick={() => downloadHeldJson(held)}
        >
          Download JSON
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar"
          onClick={() => downloadRtf(makeDoc(), `${baseName}.rtf`)}
        >
          Download RTF
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar"
          onClick={() => downloadPdf(makeDoc(), `${baseName}.pdf`)}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar"
          onClick={() => void downloadDocx(makeDoc(), `${baseName}.docx`)}
        >
          Download DOCX
        </button>
        {onPersisted && (
          <>
            <button
              type="button"
              disabled={persisting}
              className="px-3 py-2 rounded-lg text-sm border border-brand text-brand hover:bg-brand-muted font-medium disabled:opacity-50"
              onClick={() => void persistToDatabase()}
            >
              {persisting ? "Saving…" : "Save to DB"}
            </button>
            <button
              type="button"
              disabled={persisting || !dbHeroId || !dbCharacterId}
              className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar font-medium disabled:opacity-50"
              onClick={() => void persistNewVersion()}
              title={
                !dbCharacterId
                  ? "Save to DB first to create version history"
                  : "Save a new version of this character"
              }
            >
              {persisting ? "Saving…" : "Save to DB (New Version)"}
            </button>
          </>
        )}
        {modificationActive && onFinishCreation ? (
          <button
            type="button"
            className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium"
            onClick={() => {
              onFinishCreation();
              setFinishStatus(
                "Character creation finished — you can leave freely."
              );
            }}
          >
            Finish Character Creation
          </button>
        ) : null}
      </div>
      {versionLabel && (
        <p className="text-sm text-ink-muted">{versionLabel}</p>
      )}
      {finishStatus && (
        <p className="text-sm text-brand">{finishStatus}</p>
      )}
      {persistStatus && (
        <p className="text-sm text-ink-muted">{persistStatus}</p>
      )}

      <SaveNameConflictDialog
        key={conflictMatch?.characterId ?? "conflict"}
        open={conflictOpen}
        existingName={conflictMatch?.name || held.name || "Unnamed Hero"}
        suggestedName={renameSuggested}
        busy={persisting}
        error={conflictError}
        onCancel={() => {
          setConflictOpen(false);
          setConflictMatch(null);
          setConflictError(null);
        }}
        onChoose={(choice) => void handleConflictChoice(choice)}
      />

      <div className="rounded-xl border border-surface-border bg-[#1a1410] p-4 sm:p-5 shadow-xl space-y-4">
        <header>
          <h2 className="text-xl sm:text-2xl font-bold text-ink">
            {held.name || "Unnamed Hero"}
          </h2>
          <p className="text-sm text-ink-muted mt-0.5">
            {labels.race || held.raceId} · {labels.culture || held.cultureId} ·{" "}
            {labels.profession || held.professionId}
          </p>
        </header>

        <Section title="Personal">
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2 text-sm">
            {(
              [
                ["Sex", held.gender],
                ["Birthday / Age", `${held.birthday || "—"} / ${held.age}`],
                ["Height", `${held.heightCm} cm`],
                ["Weight", `${held.weightKg} kg`],
                ["Hair", held.hairColor || "—"],
                ["Eyes", held.eyeColor || "—"],
                ["Standing", held.status || "—"],
                ["Rank", held.title || "—"],
                ["Social Standing", String(currentAttrValue(held, "SO", attributeMods))],
                ["Adventure Points", String(held.apTotal || 0)],
                ["Spent AP", String(held.apSpent || 0)],
                ["AP Credit", String(apCredit)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-faint text-xs">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-ink-faint text-xs">Appearance</dt>
              <dd>{held.appearance || "—"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-ink-faint text-xs">Background</dt>
              <dd>{held.background || "—"}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Attributes">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {held.attributes.map((a) => {
              const mod = attributeModsSum(attributeMods, a.code);
              const current = currentAttrValue(held, a.code, attributeMods);
              return (
                <StatChip
                  key={a.code}
                  label={`${a.code} · ${ATTR_LABELS[a.code]}`}
                  value={current}
                  sub={`start ${a.base} · mod ${mod} · bought ${a.purchased}`}
                />
              );
            })}
            <StatChip label="GS · Speed" value={derivedValue(held, "GS")} />
          </div>
        </Section>

        <Section title="Base Values">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {held.derived
              .filter((d) => d.code !== "GS")
              .map((d) => (
                <StatChip
                  key={d.code}
                  label={DERIVED_LABELS[d.code] || d.code}
                  value={derivedValue(held, d.code)}
                  sub={`mod ${d.modification} · base ${d.base} · bought ${d.purchased}${
                    d.maxPurchased != null ? ` · max ${d.maxPurchased}` : ""
                  }`}
                />
              ))}
          </div>
        </Section>

        {held.specialAbilities.length > 0 && (
          <Section title="Special Abilities">
            <ul className="flex flex-wrap gap-1.5">
              {held.specialAbilities.map((s, i) => {
                const parts = [
                  nameOf(s.id),
                  s.talent ? `(${nameOf(s.talent)})` : "",
                  s.variant ? `— ${nameOf(s.variant)}` : "",
                ].filter(Boolean);
                return (
                  <li
                    key={`${s.id}-${i}`}
                    className="rounded border border-surface-border px-2 py-0.5 text-xs"
                  >
                    {parts.join(" ")}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {held.advantagesDisadvantages.length > 0 && (
          <Section title="Advantages & Disadvantages">
            <ul className="flex flex-wrap gap-1.5">
              {held.advantagesDisadvantages.map((t, i) => (
                <li
                  key={`${t.id}-${i}`}
                  className="rounded border border-surface-border px-2 py-0.5 text-xs"
                >
                  {formatOwnedTraitName(t, nameOf)}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Talents">
          {held.talents.length === 0 ? (
            <p className="text-ink-faint">None</p>
          ) : (
            <div className="space-y-4">
              {SHEET_TALENT_GROUP_ORDER.map((groupId) => {
                const rows = talentsByGroup.get(groupId);
                if (!rows?.length) return null;
                const isCombat = groupId === "combat";
                return (
                  <div key={groupId}>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                      {SHEET_GROUP_LABELS[groupId] || groupId}
                    </h4>
                    <ul className="space-y-0.5">
                      {rows.map((t) => {
                        const meta = TALENT_BY_ID.get(t.id);
                        const lead = sheetTalentLeadPrefix(held, t.id);
                        const probe =
                          !isCombat && meta ? formatTalentProbe(meta) : "";
                        const skt = sktFor(t.id);
                        const at = t.attack;
                        const pa =
                          at != null ? Math.max(0, t.tp - at) : null;
                        return (
                          <li
                            key={t.id}
                            className="flex justify-between gap-2 text-sm border-b border-surface-border/40 py-1 last:border-0"
                          >
                            <span className="min-w-0">
                              {lead}
                              {nameOf(t.id)}
                              {probe ? (
                                <span className="text-ink-faint text-xs ml-1">
                                  {probe}
                                </span>
                              ) : null}
                              {skt ? (
                                <span className="text-ink-faint text-xs ml-1">
                                  ({skt})
                                </span>
                              ) : null}
                            </span>
                            <span className="font-mono text-xs shrink-0 text-ink-muted">
                              {isCombat && at != null
                                ? `AT ${at}  PA ${pa}  `
                                : ""}
                              TP {t.tp}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {held.spells.length > 0 && (
          <Section title="Spells">
            <ul className="space-y-0.5">
              {held.spells.map((s) => {
                const markers = sheetSpellNamePrefix(held, s.id);
                return (
                  <li
                    key={s.id}
                    className="flex justify-between gap-2 border-b border-surface-border/40 py-1 last:border-0"
                  >
                    <span>
                      {markers}
                      {nameOf(s.id)}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      SP {s.sp}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title="Combat">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <StatChip label="BAV" value={derivedValue(held, "baseAT")} />
            <StatChip label="BPV" value={bpv} />
            <StatChip label="BRV" value={derivedValue(held, "baseBRV")} />
            <StatChip label="BIV" value={biv} />
          </div>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
            Melee weapons
          </h4>
          {held.meleeWeapons.length === 0 ? (
            <p className="text-ink-faint text-xs mb-3">None</p>
          ) : (
            <ScrollTable>
              <thead>
                <tr>
                  <Th>Weapon</Th>
                  <Th>EEC</Th>
                  <Th>DC</Th>
                  <Th>HP</Th>
                  <Th>HP/ST</Th>
                  <Th>INI</Th>
                  <Th>WM</Th>
                  <Th>AV</Th>
                  <Th>PV</Th>
                  <Th>HP*</Th>
                  <Th>BP</Th>
                </tr>
              </thead>
              <tbody>
                {held.meleeWeapons.map((w) => {
                  const mains = meleeMains(w.id);
                  return (
                    <tr key={w.id}>
                      <Td>{w.name || nameOf(w.id)}</Td>
                      <Td className="tabular-nums">{formatTypeEec(w.talent)}</Td>
                      <Td>{formatDcEnglish(w)}</Td>
                      <Td className="tabular-nums">{formatHpDice(w.tp)}</Td>
                      <Td className="tabular-nums">{formatHpSt(w)}</Td>
                      <Td className="tabular-nums">{w.ini ?? ""}</Td>
                      <Td className="tabular-nums">{formatWm(w)}</Td>
                      <Td className="tabular-nums font-semibold">
                        {meleeAttackValue(held, w, mains)}
                      </Td>
                      <Td className="tabular-nums font-semibold">
                        {meleeParryValue(held, w, mains)}
                      </Td>
                      <Td className="tabular-nums">{meleeAdjustedHp(held, w)}</Td>
                      <Td className="tabular-nums">{w.bf ?? ""}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
          )}

          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5 mt-3">
            Ranged weapons
          </h4>
          {held.rangedWeapons.length === 0 ? (
            <p className="text-ink-faint text-xs mb-3">None</p>
          ) : (
            <ScrollTable>
              <thead>
                <tr>
                  <Th>Weapon</Th>
                  <Th>EEC</Th>
                  <Th>Ranges</Th>
                  <Th>HP/Range</Th>
                  <Th>AV</Th>
                  <Th>HP</Th>
                </tr>
              </thead>
              <tbody>
                {held.rangedWeapons.map((w) => (
                  <tr key={w.id}>
                    <Td>{w.name || nameOf(w.id)}</Td>
                    <Td className="tabular-nums">{formatTypeEec(w.talent)}</Td>
                    <Td className="tabular-nums">
                      {(w.ranges ?? []).join("/")}
                    </Td>
                    <Td className="tabular-nums">
                      {(w.tpPlus ?? []).join("/")}
                    </Td>
                    <Td className="tabular-nums font-semibold">
                      {rangedAttackValue(
                        held,
                        w,
                        RANGED_CATALOG.get(w.id)?.talent
                          ? String(RANGED_CATALOG.get(w.id)!.talent)
                          : undefined
                      )}
                    </Td>
                    <Td className="tabular-nums">{formatHpDice(w.tp)}</Td>
                  </tr>
                ))}
              </tbody>
            </ScrollTable>
          )}

          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5 mt-3">
            Unarmed
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {(
              [
                ["Brawling", "Talent.Raufen"],
                ["Wrestling", "Talent.Ringen"],
              ] as const
            ).map(([label, tid]) => (
              <div
                key={tid}
                className="rounded border border-surface-border px-2 py-1.5 text-xs"
              >
                <div className="font-medium">{label}</div>
                <div className="text-ink-muted mt-0.5 tabular-nums">
                  {formatTypeEec(tid, { unarmed: true })} · HP/ST 10/3 · AV{" "}
                  {unarmedAttack(held, tid)} · PV {unarmedParry(held, tid)} ·{" "}
                  {unarmedHp(held)}
                </div>
              </div>
            ))}
          </div>

          {(held.shields.length > 0 || held.armors.length > 0) && (
            <>
              {held.shields.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                    Shields
                  </h4>
                  <ul className="space-y-1 mb-3 text-xs">
                    {held.shields.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap justify-between gap-2 border-b border-surface-border/40 py-1"
                      >
                        <span>
                          {s.name || nameOf(s.id)}
                          {s.type ? (
                            <span className="text-ink-faint">
                              {" "}
                              ({shieldTypeLabel(s.type)})
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular-nums text-ink-muted">
                          INI {s.ini ?? 0} · WM {formatWm(s)} · PV{" "}
                          {bpv + (s.wmPa ?? 0)} · BP {s.bf ?? "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {held.armors.length > 0 && (
                <>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
                    Armor
                  </h4>
                  <ul className="space-y-1 mb-2 text-xs">
                    {held.armors.map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-2 border-b border-surface-border/40 py-1"
                      >
                        <span>{a.name || nameOf(a.id)}</span>
                        <span className="tabular-nums text-ink-muted">
                          AR {a.rs ?? 0} · EC {a.be ?? 0}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-2 font-semibold pt-1">
                      <span>Total</span>
                      <span className="tabular-nums">
                        AR {sumAr} · EC {sumEc}
                      </span>
                    </li>
                  </ul>
                </>
              )}
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
            <div className="rounded border border-surface-border px-2 py-1.5">
              <span className="text-ink-faint">Evade</span>
              <div className="tabular-nums mt-0.5">
                BPV {bpv} − EC {sumEc} ={" "}
                <strong>{bpv - sumEc}</strong>
              </div>
            </div>
            <div className="rounded border border-surface-border px-2 py-1.5">
              <span className="text-ink-faint">Initiative</span>
              <div className="tabular-nums mt-0.5">
                BIV {biv} − EC {sumEc} ={" "}
                <strong>{biv - sumEc}</strong>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
