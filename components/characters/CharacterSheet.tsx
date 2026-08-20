"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { CharacterSheet as Sheet, SheetLoadoutArmor } from "@/lib/character/types";
import BodyPortal from "@/components/ui/BodyPortal";
import {
  computeAllLoadoutWeaponLines,
  type CombatValueBreakdownLine,
} from "@/lib/character/loadoutCombatValues";
import {
  computeLoadoutEncumbranceTotals,
  talentTpAfterEecEncumbrance,
} from "@/lib/character/encumbrance";
import { migrateCharacterSheet } from "@/lib/character/sheetMigration";
import { humanizeSnake } from "@/lib/display/humanize";
import { getTalentEec } from "@/lib/talents/catalog";
import CodexEntryPeekModal, {
  type CodexPeekTarget,
} from "@/components/characters/CodexEntryPeekModal";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 border border-surface-border rounded-lg overflow-hidden bg-surface-card">
      <h3 className="text-sm font-bold uppercase tracking-wide bg-brand-muted px-3 py-2 text-ink border-b border-surface-border">
        {title}
      </h3>
      <div className="p-3 text-sm text-ink">{children}</div>
    </section>
  );
}

function CodexLink({
  children,
  onOpen,
  className = "",
}: {
  children: ReactNode;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`text-left text-ink underline decoration-surface-border decoration-1 underline-offset-2 hover:decoration-brand hover:text-brand-muted ${className}`}
    >
      {children}
    </button>
  );
}

function formatSignedMod(n: number): string {
  if (n > 0) return `+${n}`;
  return String(n);
}

const HOVER_PANEL_CLOSE_MS = 220;

function subscribeFinePointerHover(callback: () => void) {
  const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getFinePointerHoverSnapshot() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Desktop/laptop with real hover; phones and most tablets are false (tap-only UX). */
function useFinePointerHover() {
  return useSyncExternalStore(
    subscribeFinePointerHover,
    getFinePointerHoverSnapshot,
    () => true,
  );
}

function WeaponCombatStatBreakdown({
  label,
  valueDisplay,
  lines,
  expectedTotal,
}: {
  label: string;
  valueDisplay: ReactNode;
  lines: CombatValueBreakdownLine[];
  expectedTotal: number;
}) {
  const finePointerHover = useFinePointerHover();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const show = pinned || (finePointerHover && hover);
  const panelId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const lineSum = lines.reduce((s, l) => s + l.delta, 0);

  function cancelScheduledHoverClose() {
    if (hoverCloseTimerRef.current != null) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }

  function scheduleHoverClose() {
    cancelScheduledHoverClose();
    hoverCloseTimerRef.current = setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setHover(false);
    }, HOVER_PANEL_CLOSE_MS);
  }

  useEffect(() => () => cancelScheduledHoverClose(), []);

  useLayoutEffect(() => {
    if (!show) {
      setPanelStyle(null);
      return;
    }
    function measure() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 12;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const compact = !finePointerHover || vw < 640;
      const spaceBelow = vh - r.bottom - margin;
      const spaceAbove = r.top - margin;
      const preferBelow = spaceBelow >= 140 || spaceBelow >= spaceAbove;

      if (compact) {
        const reserveBottom = 28;
        const maxHBelow = Math.min(
          Math.floor(vh * 0.55),
          Math.max(120, spaceBelow - reserveBottom),
        );
        const maxHAbove = Math.min(
          Math.floor(vh * 0.55),
          Math.max(120, spaceAbove - reserveBottom),
        );
        const maxHeight = preferBelow ? maxHBelow : maxHAbove;
        if (preferBelow) {
          setPanelStyle({
            position: "fixed",
            left: margin,
            right: margin,
            width: "auto",
            top: r.bottom + margin,
            maxHeight,
            zIndex: 9999,
            maxWidth: "100%",
            boxSizing: "border-box",
          });
        } else {
          setPanelStyle({
            position: "fixed",
            left: margin,
            right: margin,
            width: "auto",
            bottom: vh - r.top + margin,
            maxHeight,
            zIndex: 9999,
            maxWidth: "100%",
            boxSizing: "border-box",
          });
        }
        return;
      }

      const panelWidth = Math.min(22 * 16, vw * 0.9);
      const maxHeight = preferBelow
        ? Math.min(400, Math.max(100, spaceBelow - margin))
        : Math.min(400, Math.max(100, spaceAbove - margin));
      const right = Math.max(margin, vw - r.right);
      if (preferBelow) {
        setPanelStyle({
          position: "fixed",
          top: r.bottom + margin,
          right,
          width: panelWidth,
          maxHeight,
          zIndex: 9999,
        });
      } else {
        setPanelStyle({
          position: "fixed",
          bottom: vh - r.top + margin,
          right,
          width: panelWidth,
          maxHeight,
          zIndex: 9999,
        });
      }
    }
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [show, finePointerHover]);

  useEffect(() => {
    if (!pinned || finePointerHover) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [pinned, finePointerHover]);

  useEffect(() => {
    if (!pinned) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (anchorRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      cancelScheduledHoverClose();
      setHover(false);
      setPinned(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  useEffect(() => {
    if (!pinned) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        cancelScheduledHoverClose();
        setHover(false);
        setPinned(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned]);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => {
        if (!finePointerHover) return;
        cancelScheduledHoverClose();
        setHover(true);
      }}
      onMouseLeave={() => {
        if (!finePointerHover || pinned) return;
        scheduleHoverClose();
      }}
    >
      <button
        ref={anchorRef}
        type="button"
        className={`w-full text-right font-mono tabular-nums text-ink underline decoration-dotted decoration-surface-border/80 underline-offset-2 hover:text-brand-muted rounded px-0.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 touch-manipulation sm:min-h-0 min-h-[2.75rem] sm:py-0.5 sm:px-0.5 ${finePointerHover ? "cursor-help" : "cursor-pointer active:opacity-90"}`}
        aria-expanded={show}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setPinned((p) => !p)}
      >
        {valueDisplay}
      </button>
      {show && panelStyle ? (
        <BodyPortal>
          <>
            {pinned && !finePointerHover ? (
              <div
                className="fixed inset-0 z-[9998] bg-black/35 touch-none"
                aria-hidden
                onPointerDown={(e) => {
                  e.preventDefault();
                  cancelScheduledHoverClose();
                  setHover(false);
                  setPinned(false);
                }}
              />
            ) : null}
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={`${label} modifiers`}
              aria-modal={pinned && !finePointerHover ? true : undefined}
              style={{
                ...panelStyle,
                backgroundColor: "#231c16",
                backdropFilter: "none",
                WebkitBackdropFilter: "none",
                paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
              }}
              className="isolate overflow-y-auto overscroll-contain rounded-lg border-2 border-surface-border p-2 text-ink shadow-2xl text-left pointer-events-auto opacity-100 touch-manipulation"
              onMouseEnter={() => {
                if (!finePointerHover) return;
                cancelScheduledHoverClose();
                setHover(true);
              }}
              onMouseLeave={() => {
                if (!finePointerHover || pinned) return;
                scheduleHoverClose();
              }}
            >
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1.5">
              {label} — modifiers
            </p>
            <ul className="list-none m-0 p-0 space-y-2 text-[11px] text-ink leading-snug">
              {lines.map((l, i) => (
                <li
                  key={i}
                  className="border-b border-surface-border/40 pb-1.5 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-ink-muted shrink min-w-0">
                      {l.label}
                    </span>
                    <span className="font-mono tabular-nums shrink-0">
                      {formatSignedMod(l.delta)}
                    </span>
                  </div>
                  {l.detail ? (
                    <p className="m-0 mt-0.5 text-[10px] text-ink-faint leading-snug">
                      {l.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-ink-faint border-t border-surface-border pt-1.5">
              Sum of lines:{" "}
              <span className="font-mono text-ink">{lineSum}</span>
              {lineSum !== expectedTotal ? (
                <>
                  {" "}
                  · value shown{" "}
                  <span className="font-mono">{expectedTotal}</span>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-[10px] text-ink-faint">
              {finePointerHover
                ? "Click outside or Esc to close when pinned."
                : "Tap the dimmed area, this value again, or Esc to close."}
            </p>
          </div>
          </>
        </BodyPortal>
      ) : null}
    </div>
  );
}

export default function CharacterSheet({ sheet }: { sheet: Sheet }) {
  const sheetM = useMemo(() => migrateCharacterSheet(sheet), [sheet]);
  const loadoutWeaponLines = useMemo(() => {
    const lo = sheetM.loadout;
    if (!lo?.weapons?.length) return [];
    return computeAllLoadoutWeaponLines(sheetM, lo);
  }, [sheetM]);
  const loadoutEncTotals = useMemo(
    () =>
      computeLoadoutEncumbranceTotals(
        sheetM.loadout?.armors,
        sheetM.specialAbilities,
      ),
    [sheetM.loadout?.armors, sheetM.specialAbilities],
  );
  const MIN_ARMOR_TABLE_ROWS = 5;
  const loadoutArmorTable = useMemo(() => {
    const list = sheetM.loadout?.armors ?? [];
    const sumAr = list.reduce((s, a) => s + a.ar, 0);
    const sumIni = list.reduce((s, a) => s + a.iniModifier, 0);
    const slots: (SheetLoadoutArmor | null)[] = [...list];
    while (slots.length < MIN_ARMOR_TABLE_ROWS) slots.push(null);
    return { slots, sumAr, sumIni };
  }, [sheetM.loadout?.armors]);
  const hideCombatTalentTables =
    (sheetM.loadout?.weapons?.length ?? 0) > 0;
  const h = sheetM.header;
  const a = sheetM.attributesFinal;
  const [peek, setPeek] = useState<CodexPeekTarget | null>(null);

  const talentsByGroup = useMemo(() => {
    const m = new Map<string, typeof sheetM.talents>();
    for (const t of sheetM.talents) {
      const arr = m.get(t.group) ?? [];
      arr.push(t);
      m.set(t.group, arr);
    }
    return [...m.entries()]
      .sort(([ga], [gb]) => ga.localeCompare(gb))
      .map(([group, rows]) => ({
        group,
        label: humanizeSnake(group),
        rows: rows.slice().sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [sheetM.talents]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 text-ink font-serif">
      <CodexEntryPeekModal target={peek} onClose={() => setPeek(null)} />

      <header className="border-b-2 border-brand pb-4 mb-6">
        <h1 className="text-3xl font-bold">{h.displayName}</h1>
        <p className="text-ink-muted mt-1">
          {h.raceName} · {h.cultureName} · {h.professionName}
        </p>
        <p className="text-xs text-ink-faint mt-1">
          {h.professionCategory
            ? `${humanizeSnake(h.professionCategory)} · `
            : ""}
          {h.gender} | {h.ageYears} years old
          {h.conceptId ? (
            <>
              {" "}
              | Concept (legacy): {humanizeSnake(h.conceptId)}
            </>
          ) : null}
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Attributes">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-muted">CO</dt>
            <dd>{a.CO}</dd>
            <dt className="text-ink-muted">CL</dt>
            <dd>{a.CL}</dd>
            <dt className="text-ink-muted">IN</dt>
            <dd>{a.IN}</dd>
            <dt className="text-ink-muted">CH</dt>
            <dd>{a.CH}</dd>
            <dt className="text-ink-muted">DE</dt>
            <dd>{a.DE}</dd>
            <dt className="text-ink-muted">AG</dt>
            <dd>{a.AG}</dd>
            <dt className="text-ink-muted">CN</dt>
            <dd>{a.CN}</dd>
            <dt className="text-ink-muted">ST</dt>
            <dd>{a.ST}</dd>
            <dt className="text-ink-muted">
              <abbr title="Social Standing" className="no-underline cursor-help">
                SO
              </abbr>
            </dt>
            <dd>{a.SO}</dd>
          </dl>
        </Section>

        <Section title="Derived values">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-ink-muted">
              <abbr title="Vitality Points" className="no-underline cursor-help">
                VP
              </abbr>
            </dt>
            <dd>{sheetM.derived.VP}</dd>
            <dt className="text-ink-muted">
              <abbr title="Endurance Points" className="no-underline cursor-help">
                EP
              </abbr>
            </dt>
            <dd>{sheetM.derived.EP}</dd>
            <dt className="text-ink-muted">
              <abbr title="Wound Threshold" className="no-underline cursor-help">
                WT
              </abbr>
            </dt>
            <dd>{sheetM.derived.WT}</dd>
            <dt className="text-ink-muted">
              Base AT / PA /{" "}
              <abbr
                title="Base Ranged Value — base score for ranged attacks"
                className="no-underline cursor-help"
              >
                BRV
              </abbr>
            </dt>
            <dd>
              {sheetM.derived.baseAT} / {sheetM.derived.basePA} /{" "}
              {sheetM.derived.baseBRV}
            </dd>
            <dt className="text-ink-muted">Base INI</dt>
            <dd>{sheetM.derived.baseINI}</dd>
            <dt className="text-ink-muted">
              <abbr
                title="Resistance to Magic — bonus to saving throws vs. magic and similar effects"
                className="no-underline cursor-help"
              >
                RM
              </abbr>
            </dt>
            <dd>{sheetM.derived.RM}</dd>
            <dt className="text-ink-muted">
              <abbr title="Astral Points" className="no-underline cursor-help">
                ASP
              </abbr>
            </dt>
            <dd>{sheetM.derived.ASP}</dd>
            <dt className="text-ink-muted">
              <abbr title="Speed (movement)" className="no-underline cursor-help">
                SD
              </abbr>
            </dt>
            <dd>{sheetM.derived.GS}</dd>
          </dl>
        </Section>
      </div>

      <Section title="Advantages & disadvantages">
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Automatic advantages
        </p>
        <ul className="list-none pl-0 mb-2 space-y-1">
          {sheetM.automaticAdvantages.map((x, i) => (
            <li key={`auto-adv-${x.id}-${i}`}>
              <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
              </CodexLink>
            </li>
          ))}
        </ul>
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Chosen advantages
        </p>
        <ul className="list-none pl-0 mb-2 space-y-1">
          {sheetM.chosenAdvantages.map((x, i) => (
            <li key={`chosen-adv-${x.id}-${i}`}>
              <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
              </CodexLink>
            </li>
          ))}
        </ul>
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Automatic disadvantages
        </p>
        <ul className="list-none pl-0 mb-2 space-y-1">
          {sheetM.automaticDisadvantages.map((x, i) => (
            <li key={`auto-dis-${x.id}-${x.rating ?? ""}-${i}`}>
              {x.pick_one_disadvantages &&
              x.pick_one_disadvantages.length > 0 ? (
                <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-1">
                  <span className="text-ink-muted shrink-0">Choose one:</span>
                  {x.pick_one_disadvantages.map((alt, j) => (
                    <span
                      key={`${alt.id}-${j}`}
                      className="inline-flex items-baseline gap-1"
                    >
                      {j > 0 ? (
                        <span className="text-ink-muted"> · or · </span>
                      ) : null}
                      <CodexLink
                        onOpen={() =>
                          setPeek({ kind: "trait", id: alt.id })
                        }
                      >
                        {humanizeSnake(alt.id)}
                        {alt.rating != null ? ` (${alt.rating})` : ""}
                      </CodexLink>
                    </span>
                  ))}
                  {x.note ? (
                    <span className="text-ink-muted text-xs"> — {x.note}</span>
                  ) : null}
                </span>
              ) : (
                <>
                  <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                    {x.name ?? humanizeSnake(x.id)}
                    {x.rating != null ? ` (${x.rating})` : ""}
                  </CodexLink>
                  {x.note ? (
                    <span className="text-ink-muted text-xs"> — {x.note}</span>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="font-semibold text-xs uppercase text-ink-muted mb-1">
          Chosen disadvantages
        </p>
        <ul className="list-none pl-0 space-y-1">
          {sheetM.chosenDisadvantages.map((x, i) => (
            <li key={`chosen-dis-${x.id}-${x.rating ?? ""}-${i}`}>
              <CodexLink onOpen={() => setPeek({ kind: "trait", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
                {x.rating != null ? ` (${x.rating})` : ""}
              </CodexLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Special abilities">
        <ul className="list-none pl-0 space-y-1">
          {sheetM.specialAbilities.map((x) => (
            <li key={x.id + (x.note ?? "")}>
              <CodexLink onOpen={() => setPeek({ kind: "sa", id: x.id })}>
                {x.name ?? humanizeSnake(x.id)}
              </CodexLink>
              {x.note ? (
                <span className="text-ink-muted text-xs"> — {x.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Talents">
        <p className="mb-3 text-[10px] text-ink-faint leading-snug max-w-xl">
          Square brackets: TP after applying effective EC (from total worn EC after Armor Use, via this talent’s
          codex <span className="font-mono">eec</span> pattern). If <span className="font-mono">eec</span> is missing in
          the codex, there is no encumbrance penalty here. Base TP is on the right.
        </p>
        <div className="space-y-5">
          {talentsByGroup.map(({ group, label, rows }) => (
            <div key={group}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-brand-muted mb-2 border-b border-surface-border pb-1">
                {label}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-ink-muted">
                      <th className="py-1 pr-2 align-bottom">Talent</th>
                      <th className="py-1 font-mono text-right align-bottom tabular-nums">
                        TP
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-surface-border/60"
                      >
                        <td className="py-1 pr-2">
                          <CodexLink
                            onOpen={() =>
                              setPeek({ kind: "talent", id: t.id })
                            }
                          >
                            {t.name}
                          </CodexLink>
                        </td>
                        <td className="py-1 text-right align-top">
                          {(() => {
                            const eec = getTalentEec(t.id);
                            const { ebe, effectiveTp } = talentTpAfterEecEncumbrance(
                              t.tp,
                              eec,
                              loadoutEncTotals.effectiveTotalEC,
                            );
                            const showBracket =
                              eec != null &&
                              String(eec).trim() !== "" &&
                              String(eec).trim() !== "0" &&
                              ebe > 0;
                            return (
                              <div className="inline-flex justify-end items-baseline gap-2 font-mono tabular-nums">
                                <span className="inline-block min-w-[3.5rem] text-right text-[11px] text-ink-muted">
                                  {showBracket ? `[${effectiveTp}]` : ""}
                                </span>
                                <span className="text-ink">{t.tp}</span>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {sheetM.spells.length > 0 && (
        <Section title="Spells">
          <ul className="list-none pl-0 space-y-1">
            {sheetM.spells.map((s) => (
              <li key={s.id}>
                <CodexLink onOpen={() => setPeek({ kind: "spell", id: s.id })}>
                  {s.name}
                </CodexLink>
                <span className="text-ink-muted"> — SP {s.sp}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!hideCombatTalentTables && (
        <div className="grid md:grid-cols-2 gap-4">
          {sheetM.combatMelee.length > 0 && (
            <Section title="Melee combat">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-muted text-left">
                    <th className="pb-1">Weapon talent</th>
                    <th>TP</th>
                    <th>AT</th>
                    <th>PA</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetM.combatMelee.map((c) => (
                    <tr
                      key={c.talentId}
                      className="border-t border-surface-border/60"
                    >
                      <td className="py-1">
                        <CodexLink
                          onOpen={() =>
                            setPeek({ kind: "talent", id: c.talentId })
                          }
                        >
                          {c.talentName}
                        </CodexLink>
                      </td>
                      <td>{c.tp}</td>
                      <td>{c.finalAT}</td>
                      <td>{c.finalPA}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
          {sheetM.combatRanged.length > 0 && (
            <Section title="Ranged combat">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-muted text-left">
                    <th className="pb-1">Talent</th>
                    <th>TP</th>
                    <th>AT</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetM.combatRanged.map((c) => (
                    <tr
                      key={c.talentId}
                      className="border-t border-surface-border/60"
                    >
                      <td className="py-1">
                        <CodexLink
                          onOpen={() =>
                            setPeek({ kind: "talent", id: c.talentId })
                          }
                        >
                          {c.talentName}
                        </CodexLink>
                      </td>
                      <td>{c.tp}</td>
                      <td>{c.finalAT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}

      {sheetM.loadout &&
        ((sheetM.loadout.weapons?.length ?? 0) > 0 ||
          (sheetM.loadout.armors?.length ?? 0) > 0) && (
        <Section title="Chosen loadout (wizard)">
          <div className="space-y-5 text-sm">
            {(sheetM.loadout.weapons?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted mb-2">
                  Weapons (final AT / PA / INI)
                </p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs border-collapse min-w-[20rem]">
                    <thead>
                      <tr className="text-left text-ink-muted border-b border-surface-border/80">
                        <th className="py-1.5 pr-2 font-semibold">Weapon</th>
                        <th className="py-1.5 pr-2 text-right font-semibold tabular-nums w-[3rem]">
                          AT
                        </th>
                        <th className="py-1.5 pr-2 text-right font-semibold tabular-nums w-[3rem]">
                          PA
                        </th>
                        <th className="py-1.5 pr-2 text-right font-semibold tabular-nums w-[3rem]">
                          INI
                        </th>
                        <th className="py-1.5 pl-2 font-semibold min-w-[6rem]">
                          Damage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadoutWeaponLines.map((row) => (
                        <tr
                          key={row.weaponId}
                          className="border-b border-surface-border/50 align-top"
                        >
                          <td className="py-2 pr-2">
                            <CodexLink
                              onOpen={() =>
                                setPeek({ kind: "equipment", id: row.weaponId })
                              }
                            >
                              {row.weaponName}
                            </CodexLink>
                            {row.notes.length > 0 ? (
                              <ul className="mt-1 list-disc pl-4 m-0 text-ink-faint text-[11px] leading-snug">
                                {row.notes.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                          <td className="py-2 pr-2 align-top">
                            <WeaponCombatStatBreakdown
                              label="AT"
                              expectedTotal={row.finalAT}
                              lines={row.atBreakdown}
                              valueDisplay={row.finalAT}
                            />
                          </td>
                          <td className="py-2 pr-2 align-top">
                            {row.finalPA === null ? (
                              <span className="block text-right font-mono tabular-nums text-ink">
                                —
                              </span>
                            ) : (
                              <WeaponCombatStatBreakdown
                                label="PA"
                                expectedTotal={row.finalPA}
                                lines={row.paBreakdown ?? []}
                                valueDisplay={row.finalPA}
                              />
                            )}
                          </td>
                          <td className="py-2 pr-2 align-top">
                            <WeaponCombatStatBreakdown
                              label="INI"
                              expectedTotal={row.ini}
                              lines={row.iniBreakdown}
                              valueDisplay={row.ini}
                            />
                          </td>
                          <td className="py-2 pl-2 align-top max-w-[12rem]">
                            <div className="font-mono text-ink break-words">
                              {row.damage ?? "—"}
                            </div>
                            {row.damageStrengthNote ? (
                              <p className="mt-0.5 m-0 text-[10px] text-ink-faint leading-snug">
                                {row.damageStrengthNote}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-ink-faint leading-relaxed">
                  Damage uses final ST from the sheet plus the weapon&apos;s HP/ST rule from the
                  codex (<span className="font-mono">tp_kk</span>) where present; dice are
                  unchanged; bonus HP from the Strength rule adds to the fixed modifier. WMs tilt
                  the TP split across AT and PA (per-talent Σ of PA − AT), including shields. INI =
                  base + Σ armor INI + weapon INI. Encumbrance: worn EC total is{" "}
                  <strong>{loadoutEncTotals.effectiveTotalEC}</strong> (raw{" "}
                  <strong>{loadoutEncTotals.rawTotalEC}</strong>
                  {loadoutEncTotals.armorUse.summary
                    ? ` — ${loadoutEncTotals.armorUse.summary}`
                    : ""}
                  ); melee applies ⌊effective EC / 2⌋ to AT and ⌈effective EC / 2⌉ to PA; ranged and
                  jousting apply the full effective EC penalty to AT. Hover or tap AT, PA, or INI for
                  the full breakdown. AR stacking is not modeled.
                </p>
              </div>
            )}
            {(sheetM.loadout.armors?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-ink-muted mb-2">
                  Armor & shields
                </p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-xs border-collapse border border-surface-border min-w-[16rem]">
                    <thead>
                      <tr className="bg-surface-sidebar/40 border-b-2 border-surface-border text-left">
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold">
                          Armor
                        </th>
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold text-center w-[3.5rem]">
                          AR
                        </th>
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold text-center w-[3.5rem]">
                          <abbr
                            title="Encumbrance (codex JSON field ec)"
                            className="no-underline cursor-help"
                          >
                            EC
                          </abbr>
                        </th>
                        <th className="border border-surface-border/80 px-2 py-1.5 font-semibold text-center w-[3.5rem]">
                          INI
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadoutArmorTable.slots.map((ar, idx) => (
                        <tr
                          key={ar?.id ?? `slot-${idx}`}
                          className="border-b border-surface-border/60"
                        >
                          <td className="border-x border-surface-border/50 px-2 py-1.5 align-middle">
                            {ar ? (
                              <CodexLink
                                onOpen={() =>
                                  setPeek({ kind: "equipment", id: ar.id })
                                }
                              >
                                {ar.name}
                              </CodexLink>
                            ) : (
                              <span className="text-ink-faint">&nbsp;</span>
                            )}
                          </td>
                          <td className="border-x border-surface-border/50 px-2 py-1.5 text-center font-mono tabular-nums">
                            {ar ? ar.ar : ""}
                          </td>
                          <td className="border-x border-surface-border/50 px-2 py-1.5 text-center font-mono tabular-nums">
                            {ar ? ar.ec : ""}
                          </td>
                          <td className="border-x border-surface-border/50 px-2 py-1.5 text-center font-mono tabular-nums">
                            {ar ? (
                              <>
                                {ar.iniModifier >= 0 ? "+" : ""}
                                {ar.iniModifier}
                              </>
                            ) : (
                              ""
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-surface-border bg-surface-sidebar/30 font-semibold">
                        <td className="border-x border-surface-border/50 px-2 py-2">
                          Total
                        </td>
                        <td className="border-x border-surface-border/50 px-2 py-2 text-center font-mono tabular-nums">
                          {loadoutArmorTable.sumAr}
                        </td>
                        <td className="border-x border-surface-border/50 px-2 py-2 text-center font-mono tabular-nums">
                          {loadoutEncTotals.effectiveTotalEC}
                        </td>
                        <td className="border-x border-surface-border/50 px-2 py-2 text-center font-mono tabular-nums">
                          {loadoutArmorTable.sumIni >= 0 ? "+" : ""}
                          {loadoutArmorTable.sumIni}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[11px] text-ink-faint leading-relaxed">
                  The <strong>Total</strong> EC (<strong>{loadoutEncTotals.effectiveTotalEC}</strong>)
                  is the aggregate after Armor Use (tiers I–III reduce the total once, not per
                  piece). Rows show each piece&apos;s codex EC (
                  <span className="font-mono">ec</span>). Raw sum: <strong>{loadoutEncTotals.rawTotalEC}</strong>.
                  Total AR is the sum of individual piece AR; stacking rules are not modeled.
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Starting equipment">
        <p className="mb-2">
          Starting money:{" "}
          <strong>{sheetM.startingMoneySilbertaler}</strong> silver thaler (SO²)
        </p>
        <ul className="list-none pl-0 text-xs space-y-1">
          {sheetM.startingEquipment.map((id) => (
            <li key={id}>
              <CodexLink
                onOpen={() => setPeek({ kind: "equipment", id })}
                className="font-mono text-xs"
              >
                {humanizeSnake(id)}
              </CodexLink>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Appearance">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-ink-muted">Height</dt>
          <dd>{sheetM.physical.heightCm} cm</dd>
          <dt className="text-ink-muted">Weight</dt>
          <dd>{sheetM.physical.weightKg} kg</dd>
          <dt className="text-ink-muted">Hair / Eyes</dt>
          <dd>
            {sheetM.physical.hair} / {sheetM.physical.eyes}
          </dd>
        </dl>
      </Section>

      <Section title="Generation summary">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
          <dt className="text-ink-muted">Remaining GP</dt>
          <dd>{sheetM.budgets.gpEnd}</dd>
          <dt className="text-ink-muted">Creation AP used / total</dt>
          <dd>
            {sheetM.budgets.tgpSpent} / {sheetM.budgets.tgpTotal}
          </dd>
          <dt className="text-ink-muted">Magic AP used / cap</dt>
          <dd>
            {sheetM.budgets.sgpSpent} / {sheetM.budgets.sgpTotal}
          </dd>
          <dt className="text-ink-muted">Extra AP applied</dt>
          <dd>{sheetM.budgets.extraApApplied}</dd>
        </dl>
      </Section>

      {sheetM.notes && sheetM.notes.length > 0 && (
        <div className="text-xs text-amber-700 dark:text-amber-400 mt-4 p-2 rounded bg-amber-950/20">
          {sheetM.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
    </div>
  );
}
