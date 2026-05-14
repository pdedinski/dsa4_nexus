"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Sword, Shield, Zap, AlertTriangle } from "lucide-react";
import clsx from "clsx";

type ManeuverEntry = {
  id: string;
  name: string;
  german_name?: string;
  type?: string;
  base_modifier?: string;
  requires_sa?: boolean;
  sa_requirement?: string | null;
  compatible_talents?: string[];
  description?: string;
  source?: string;
  [key: string]: unknown;
};

type CombatData = {
  the_call_rules?: { description?: string; source?: string };
  attack_actions?: ManeuverEntry[];
  defense_actions?: ManeuverEntry[];
  free_actions?: ManeuverEntry[];
  special_situations?: ManeuverEntry[];
};

function formatDescription(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("- ")) {
      return (
        <li key={i} className="ml-4 list-disc text-ink-muted">
          {line.slice(2)}
        </li>
      );
    }
    if (line.trim() === "") {
      return <div key={i} className="h-2" />;
    }
    return (
      <p key={i} className={clsx("text-ink-muted", line.match(/^[A-Z][^a-z]*:$/) && "font-semibold text-ink mt-2")}>
        {line}
      </p>
    );
  });
}

function ManeuverCard({ entry }: { entry: ManeuverEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-surface-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-card transition-colors text-left"
      >
        <span className="mt-0.5 shrink-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-ink-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-ink-muted" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink text-sm">{entry.name}</span>
            {entry.german_name && (
              <span className="text-xs text-ink-faint italic">({entry.german_name})</span>
            )}
            {entry.requires_sa && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-muted text-brand border border-brand/30 shrink-0">
                SA Required
              </span>
            )}
          </div>
          {entry.base_modifier && (
            <p className="text-xs text-brand mt-0.5 font-mono">{entry.base_modifier}</p>
          )}
          {entry.compatible_talents && entry.compatible_talents.length > 0 && (
            <p className="text-xs text-ink-faint mt-0.5">
              {entry.compatible_talents.map((t) => t.replace(/_/g, " ")).join(", ")}
            </p>
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-surface-border bg-surface-card">
          {entry.sa_requirement && (
            <div className="mt-3 mb-2 text-xs text-brand bg-brand-muted px-2 py-1 rounded inline-block">
              Requires SA: {entry.sa_requirement.replace(/_/g, " ")}
            </div>
          )}
          {entry.description && (
            <div className="mt-2 text-sm space-y-0.5">
              {formatDescription(entry.description)}
            </div>
          )}
          {entry.source && (
            <p className="mt-3 text-xs text-ink-faint border-t border-surface-border pt-2">
              {entry.source}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-5 h-5 text-brand shrink-0" />
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <span className="text-xs text-ink-faint ml-1">({count})</span>
    </div>
  );
}

const COMBAT_FLOW = [
  { step: "1", label: "Initiative", detail: "Roll 1d6 + base INI (round((CO+CO+IN+AG)/5) + racial mod) + weapon/armor INI modifiers. Highest acts first." },
  { step: "2", label: "Action", detail: "Each combatant spends ONE action: Attack, Free Action, or Special Action (flee, draw weapon, etc.)." },
  { step: "3", label: "Defense", detail: "After a successful attack, the target chooses ONE defense: Parry (PA roll), Shield Parry, or Dodge." },
  { step: "4", label: "Damage", detail: "On failed defense: roll weapon TP, subtract RS. If TP ≥ KO/2 → wound (-1 AT/PA/checks per wound marker)." },
  { step: "5", label: "End of Round", detail: "Ongoing effects resolve (bleed, poison, etc.). Initiative order continues from round 1 unless re-rolled." },
];

const STAT_FORMULAS = [
  {
    stat: "AT",
    formula:
      "round((CO+AG+ST)/5) + melee TP allocation + weapon AT mod − ⌊effective EC / 2⌋ (melee encumbrance)",
  },
  {
    stat: "PA",
    formula:
      "round((IN+AG+ST)/5) + melee TP allocation + weapon PA mod − ⌈effective EC / 2⌉ (melee encumbrance)",
  },
  {
    stat: "BRV",
    formula:
      "round((IN+AG+ST)/5) + ranged TP + weapon AT mod − effective EC + range mod (ranged attack value)",
  },
  { stat: "INI", formula: "round((CO+CO+IN+AG)/5) + racial mod + 1d6" },
  {
    stat: "effective EC",
    formula: "encumbrance after applying the combat talent’s EEC pattern to total worn EC (Armor Use applied first)",
  },
  { stat: "Melee AT (EC)", formula: "⌊effective EC / 2⌋" },
  { stat: "Melee PA (EC)", formula: "⌈effective EC / 2⌉" },
  { stat: "Wound", formula: "effective DP ≥ floor(KO / 2)" },
];

const RANGE_MODS = [
  { band: "Very Close (sehr nah)", mod: "BRV −2" },
  { band: "Close (nah)", mod: "BRV +0" },
  { band: "Medium (mittel)", mod: "BRV +4" },
  { band: "Far (weit)", mod: "BRV +8" },
  { band: "Extreme (extrem weit)", mod: "BRV +12" },
];

export default function CombatRulesClient({ data }: { data: CombatData }) {
  const [activeSection, setActiveSection] = useState<string>("flow");

  const sections = [
    { id: "flow", label: "Combat Flow" },
    { id: "attack", label: "Attack Actions" },
    { id: "defense", label: "Defense Actions" },
    { id: "free", label: "Free Actions" },
    { id: "special", label: "Special Situations" },
    { id: "call", label: "The Call" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          <Sword className="w-6 h-6 text-brand" />
          Combat Rules
        </h1>
        <p className="text-ink-muted text-sm mt-1">
          TDE 4.1 / DSA 4.1 — Sources: BRW pp. 99–108, Wege des Schwertes pp. 58–107
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b border-surface-border pb-3">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              activeSection === s.id
                ? "bg-brand-muted text-ink font-semibold border border-brand/30"
                : "text-ink-muted hover:text-ink hover:bg-surface-card"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* COMBAT FLOW */}
      {activeSection === "flow" && (
        <div className="space-y-6">
          {/* Round sequence */}
          <div>
            <SectionHeader icon={Sword} title="Round Sequence" count={COMBAT_FLOW.length} />
            <div className="space-y-2">
              {COMBAT_FLOW.map(({ step, label, detail }) => (
                <div key={step} className="flex gap-3 bg-surface-card border border-surface-border rounded-lg px-4 py-3">
                  <div className="w-7 h-7 rounded-full bg-brand-muted border border-brand/40 flex items-center justify-center shrink-0 text-xs font-bold text-brand">
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm">{label}</p>
                    <p className="text-ink-muted text-sm mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key formulas */}
          <div>
            <SectionHeader icon={Zap} title="Key Formulas" count={STAT_FORMULAS.length} />
            <div className="border border-surface-border rounded-lg overflow-hidden">
              {STAT_FORMULAS.map(({ stat, formula }, i) => (
                <div
                  key={stat}
                  className={clsx(
                    "flex items-start gap-3 px-4 py-2.5 text-sm",
                    i % 2 === 0 ? "bg-surface-card" : "bg-transparent"
                  )}
                >
                  <span className="font-bold text-brand w-14 shrink-0 font-mono">{stat}</span>
                  <span className="text-ink-muted font-mono text-xs leading-relaxed">{formula}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Range modifiers */}
          <div>
            <SectionHeader icon={Shield} title="BRV range modifiers" count={RANGE_MODS.length} />
            <div className="border border-surface-border rounded-lg overflow-hidden">
              {RANGE_MODS.map(({ band, mod }, i) => (
                <div
                  key={band}
                  className={clsx(
                    "flex items-center justify-between px-4 py-2.5 text-sm",
                    i % 2 === 0 ? "bg-surface-card" : "bg-transparent"
                  )}
                >
                  <span className="text-ink">{band}</span>
                  <span className={clsx("font-mono font-semibold", mod.includes("−") ? "text-red-400" : "text-green-400")}>
                    {mod}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Critical / Fumble */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-surface-card border border-surface-border rounded-lg px-4 py-3">
              <p className="font-semibold text-ink text-sm mb-1">Critical Hit (1 on d20)</p>
              <p className="text-ink-muted text-sm">Roll again. If second roll also ≤ AT → confirmed critical: double damage, no defense allowed. Otherwise normal hit.</p>
            </div>
            <div className="bg-surface-card border border-surface-border rounded-lg px-4 py-3">
              <p className="font-semibold text-ink text-sm mb-1">Fumble (20 on d20)</p>
              <p className="text-ink-muted text-sm">Roll on fumble table (BRW p. 108). Common results: weapon dropped, attacker falls, weapon breaks.</p>
            </div>
          </div>

          {/* Wound table */}
          <div>
            <SectionHeader icon={AlertTriangle} title="Wound Penalties" count={3} />
            <div className="border border-surface-border rounded-lg overflow-hidden">
              {[
                { w: "1st Wound", pen: "−1 AT, −1 PA, −1 to all checks" },
                { w: "2nd Wound", pen: "−2 AT, −2 PA, −2 to all checks (cumulative)" },
                { w: "Each additional", pen: "−1 per wound marker (cumulative)" },
              ].map(({ w, pen }, i) => (
                <div
                  key={w}
                  className={clsx("flex items-center justify-between px-4 py-2.5 text-sm", i % 2 === 0 ? "bg-surface-card" : "")}
                >
                  <span className="text-ink font-semibold">{w}</span>
                  <span className="text-red-400 font-mono text-xs">{pen}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ATTACK ACTIONS */}
      {activeSection === "attack" && (
        <div className="space-y-2">
          <SectionHeader icon={Sword} title="Attack Actions" count={data.attack_actions?.length ?? 0} />
          {(data.attack_actions ?? []).map((entry) => (
            <ManeuverCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* DEFENSE ACTIONS */}
      {activeSection === "defense" && (
        <div className="space-y-2">
          <SectionHeader icon={Shield} title="Defense Actions" count={data.defense_actions?.length ?? 0} />
          {(data.defense_actions ?? []).map((entry) => (
            <ManeuverCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* FREE ACTIONS */}
      {activeSection === "free" && (
        <div className="space-y-2">
          <SectionHeader icon={Zap} title="Free Actions" count={data.free_actions?.length ?? 0} />
          {(data.free_actions ?? []).map((entry) => (
            <ManeuverCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* SPECIAL SITUATIONS */}
      {activeSection === "special" && (
        <div className="space-y-2">
          <SectionHeader icon={AlertTriangle} title="Special Situations" count={data.special_situations?.length ?? 0} />
          {(data.special_situations ?? []).map((entry) => (
            <ManeuverCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* THE CALL */}
      {activeSection === "call" && data.the_call_rules && (
        <div>
          <SectionHeader icon={Zap} title="The Call" count={1} />
          <div className="bg-surface-card border border-surface-border rounded-lg px-5 py-4">
            <div className="text-sm space-y-1">
              {formatDescription(data.the_call_rules.description ?? "")}
            </div>
            {data.the_call_rules.source && (
              <p className="mt-4 text-xs text-ink-faint border-t border-surface-border pt-3">
                {data.the_call_rules.source}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
