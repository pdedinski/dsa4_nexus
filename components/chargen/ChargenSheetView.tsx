"use client";

import type { HeldModel } from "@/lib/chargen/types";
import {
  ATTR_LABELS,
  attrValue,
  derivedValue,
} from "@/lib/chargen/types";
import { downloadHeldJson } from "@/lib/chargen/io/exportJson";
import { downloadLegacyHeldXml } from "@/lib/chargen/io/exportLegacyXml";
import { buildSheetDocument } from "@/lib/chargen/export/sheetDocument";
import { downloadRtf } from "@/lib/chargen/export/toRtf";
import { downloadPdf } from "@/lib/chargen/export/toPdf";
import { downloadDocx } from "@/lib/chargen/export/toDocx";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="text-base font-bold text-ink border-b border-surface-border pb-1 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function ChargenSheetView({
  held,
  labels,
}: {
  held: HeldModel;
  labels: {
    race?: string;
    culture?: string;
    profession?: string;
    byId: Record<string, string>;
  };
}) {
  const nameOf = (id: string) => labels.byId[id] || id;
  const baseName = (held.name || "hero").replace(/[^\w\-]+/g, "_");

  function makeDoc() {
    return buildSheetDocument(held, {
      race: labels.race,
      culture: labels.culture,
      profession: labels.profession,
      talentName: nameOf,
      spellName: nameOf,
      traitName: nameOf,
      saName: nameOf,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm bg-brand text-white font-medium"
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
        <button
          type="button"
          className="px-3 py-2 rounded-lg text-sm border border-surface-border text-ink hover:bg-surface-sidebar"
          onClick={() => downloadLegacyHeldXml(held, `${baseName}.dcg`)}
        >
          Download XML (.dcg)
        </button>
      </div>

      <div className="rounded-xl border border-surface-border bg-[#1a1410] p-5 shadow-xl">
        <h2 className="text-2xl font-bold text-ink mb-1">
          {held.name || "Unnamed Hero"}
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          {labels.race || held.raceId} · {labels.culture || held.cultureId} ·{" "}
          {labels.profession || held.professionId}
        </p>

        <Section title="Personal">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-ink-faint">Gender</dt>
              <dd>{held.gender}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Age</dt>
              <dd>{held.age}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Height / Weight</dt>
              <dd>
                {held.heightCm} cm / {held.weightKg} kg
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Hair / Eyes</dt>
              <dd>
                {held.hairColor || "—"} / {held.eyeColor || "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-faint">Appearance</dt>
              <dd>{held.appearance || "—"}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Attributes">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm">
            {held.attributes.map((a) => (
              <div
                key={a.code}
                className="rounded border border-surface-border px-2 py-1.5"
              >
                <div className="text-ink-faint text-xs">
                  {a.code} · {ATTR_LABELS[a.code]}
                </div>
                <div className="font-semibold text-lg">
                  {attrValue(held, a.code)}
                </div>
                <div className="text-xs text-ink-faint">
                  base {a.base} + {a.purchased}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Derived values">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-sm">
            {held.derived.map((d) => (
              <div
                key={d.code}
                className="rounded border border-surface-border px-2 py-1.5"
              >
                <div className="text-ink-faint text-xs">{d.code}</div>
                <div className="font-semibold">
                  {derivedValue(held, d.code)}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Talents">
          {held.talents.length === 0 ? (
            <p className="text-sm text-ink-faint">None</p>
          ) : (
            <ul className="text-sm columns-2 gap-4">
              {held.talents.map((t) => {
                const lead = held.leadTalents.includes(t.id) ? "* " : "";
                const at = t.attack;
                const pa =
                  at != null ? Math.max(0, t.tp - at) : null;
                return (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span>
                      {lead}
                      {nameOf(t.id)}
                    </span>
                    <span className="font-mono shrink-0">
                      {at != null ? `AT ${at} ` : ""}
                      {pa != null ? `PA ${pa} ` : ""}
                      TP {t.tp}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Spells">
          {held.spells.length === 0 ? (
            <p className="text-sm text-ink-faint">None</p>
          ) : (
            <ul className="text-sm columns-2 gap-4">
              {held.spells.map((s) => {
                const markers = [
                  held.houseSpells.includes(s.id) ? "**" : "",
                  held.leadSpells.includes(s.id) ? "*" : "",
                ]
                  .filter(Boolean)
                  .join("");
                return (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span>
                      {markers ? `${markers} ` : ""}
                      {nameOf(s.id)}
                    </span>
                    <span className="font-mono">{s.sp}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="Advantages / Disadvantages">
          <p className="text-sm">
            {held.advantagesDisadvantages.map((t) => nameOf(t.id)).join(", ") ||
              "—"}
          </p>
        </Section>

        <Section title="Special Abilities">
          <p className="text-sm">
            {held.specialAbilities.map((s) => nameOf(s.id)).join(", ") || "—"}
          </p>
        </Section>

        <Section title="Equipment">
          <p className="text-sm text-ink-muted mb-1">Melee</p>
          <p className="text-sm mb-2">
            {held.meleeWeapons.map((w) => w.name || nameOf(w.id)).join(", ") ||
              "—"}
          </p>
          <p className="text-sm text-ink-muted mb-1">Ranged</p>
          <p className="text-sm mb-2">
            {held.rangedWeapons.map((w) => w.name || nameOf(w.id)).join(", ") ||
              "—"}
          </p>
          <p className="text-sm text-ink-muted mb-1">Armor</p>
          <p className="text-sm mb-2">
            {held.armors.map((a) => a.name || nameOf(a.id)).join(", ") || "—"}
          </p>
          <p className="text-sm text-ink-muted mb-1">Shields</p>
          <p className="text-sm">
            {held.shields.map((s) => s.name || nameOf(s.id)).join(", ") || "—"}
          </p>
        </Section>
      </div>
    </div>
  );
}
