import type { ReactNode } from "react";

interface Props {
  payload: Record<string, unknown>;
  category: string;
  fileKey: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "" || value === false)
    return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-surface-border last:border-0 text-sm">
      <span className="text-ink-muted w-36 shrink-0 capitalize">
        {label.replace(/_/g, " ")}
      </span>
      <span className="text-ink flex-1">{value}</span>
    </div>
  );
}

function Tags({ items }: { items: unknown[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span
          key={i}
          className="text-xs px-2 py-0.5 rounded bg-surface-border text-ink-muted"
        >
          {String(t).replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-surface-border rounded-lg px-3 py-2 min-w-[4rem]">
      <span className="text-ink font-bold text-sm">{value || "—"}</span>
      <span className="text-ink-faint text-xs mt-0.5 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

function ObjTable({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v != null);
  if (entries.length === 0)
    return <span className="text-ink-muted text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="text-xs text-ink bg-surface-border px-2 py-0.5 rounded"
        >
          {k}: <strong>{String(v)}</strong>
        </span>
      ))}
    </div>
  );
}

function Source({ src }: { src: unknown }) {
  if (!src) return null;
  return <p className="text-xs text-ink-faint mt-3 italic">{String(src)}</p>;
}

/** BRW p.155 — ranged combat (RC) check modifiers per distance class. */
const WEAPON_RANGE_FK_BY_BAND = [-2, 0, 4, 8, 12] as const;

const WEAPON_RANGE_BAND_LABELS = [
  "Very close",
  "Close",
  "Medium",
  "Far",
  "Very far",
] as const;

function formatSignedMod(n: number): string {
  if (n === 0) return "±0";
  if (n > 0) return `+${n}`;
  return String(n);
}

function formatTpPlusCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v === 0) return "0";
    return formatSignedMod(v);
  }
  return String(v);
}

function WeaponRangeBandsBlock({ p }: { p: Record<string, unknown> }) {
  const raw = p.range_bands_schritt_upper;
  if (!Array.isArray(raw) || raw.length !== 5) return null;
  const bands = raw.map((x) => Number(x));
  if (bands.some((n) => !Number.isFinite(n))) return null;

  const tpRaw = p.tp_plus_by_range_band;
  const tpPlus =
    Array.isArray(tpRaw) && tpRaw.length === 5 ? tpRaw : null;

  return (
    <div className="mt-3 rounded-lg border border-surface-border overflow-hidden">
      <div className="bg-surface-border/80 px-3 py-2 text-xs font-medium text-ink-muted">
        Range bands (paces, BRW)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-xs text-ink-muted">
              <th className="px-3 py-2 font-normal">Class</th>
              <th className="px-3 py-2 font-normal">≤ paces</th>
              {tpPlus ? (
                <th className="px-3 py-2 font-normal">TP+ (optional)</th>
              ) : null}
              <th className="px-3 py-2 font-normal">RC</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((maxSchritt, i) => (
              <tr
                key={i}
                className="border-b border-surface-border last:border-b-0"
              >
                <td className="px-3 py-1.5 text-ink">
                  {WEAPON_RANGE_BAND_LABELS[i]}
                </td>
                <td className="px-3 py-1.5 text-ink tabular-nums font-medium">
                  {maxSchritt}
                </td>
                {tpPlus ? (
                  <td className="px-3 py-1.5 text-ink tabular-nums">
                    {formatTpPlusCell(tpPlus[i])}
                  </td>
                ) : null}
                <td className="px-3 py-1.5 text-ink-muted tabular-nums">
                  {formatSignedMod(WEAPON_RANGE_FK_BY_BAND[i])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {str(p.range_bands_source) && (
        <p className="px-3 py-2 text-xs text-ink-faint border-t border-surface-border bg-surface-border/40">
          {str(p.range_bands_source)}
        </p>
      )}
    </div>
  );
}

// ─── Entry layouts ────────────────────────────────────────────────────────────

export default function EntryDetail({ payload, category, fileKey }: Props) {
  if (category === "magic" && fileKey === "spells")
    return <SpellDetail p={payload} />;
  if (category === "core" && fileKey === "races")
    return <RaceDetail p={payload} />;
  if (category === "core" && fileKey === "cultures")
    return <CultureDetail p={payload} />;
  if (category === "core" && fileKey === "professions")
    return <ProfessionDetail p={payload} />;
  if (category === "talents")
    return <TalentDetail p={payload} />;
  if (category === "equipment")
    return <EquipmentDetail p={payload} fileKey={fileKey} />;
  if (category === "character")
    return <CharacterTraitDetail p={payload} />;
  if (category === "combat")
    return <CombatManeuverDetail p={payload} />;
  return <GenericDetail p={payload} />;
}

// ─── Spell ───────────────────────────────────────────────────────────────────

function SpellDetail({ p }: { p: Record<string, unknown> }) {
  const attrs = Array.isArray(p.test_attributes)
    ? (p.test_attributes as string[]).join(" / ")
    : "";
  const traditions = Array.isArray(p.traditions)
    ? (p.traditions as unknown[])
    : [];
  const desc = str(p.description);
  const descParas =
    desc.length > 0
      ? desc.split(/\n\n+/).filter((block) => block.trim().length > 0)
      : [];

  return (
    <div className="space-y-4">
      {descParas.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-ink-muted uppercase tracking-wide">
            Description
          </div>
          {descParas.map((block, i) => (
            <p
              key={i}
              className="text-ink text-sm leading-relaxed whitespace-pre-wrap"
            >
              {block.trim()}
            </p>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-surface-border bg-surface-sidebar/60 overflow-hidden">
        <div className="px-3 py-2 text-xs font-medium text-ink-muted border-b border-surface-border bg-surface-border/50">
          Casting and rules
        </div>
        <div className="px-3 py-2 space-y-0">
          {str(p.german_name) && str(p.german_name) !== str(p.name) && (
            <Row label="German name" value={str(p.german_name)} />
          )}
          {attrs && <Row label="Test" value={attrs} />}
          {str(p.advancement_column) && (
            <Row label="Advancement column" value={str(p.advancement_column)} />
          )}
          {(p.activation_cost_guild != null ||
            p.activation_cost_elf != null) && (
            <Row
              label="Activation (guild / elf)"
              value={`${p.activation_cost_guild ?? "—"} / ${p.activation_cost_elf ?? "—"}`}
            />
          )}
          {p.max_starting_sp != null && (
            <Row label="Max starting SP" value={str(p.max_starting_sp)} />
          )}
          {str(p.casting_time) && (
            <Row label="Casting time" value={str(p.casting_time)} />
          )}
          {str(p.asp_cost) && <Row label="ASP cost" value={str(p.asp_cost)} />}
          {str(p.range) && <Row label="Range" value={str(p.range)} />}
          {str(p.duration) && <Row label="Duration" value={str(p.duration)} />}
          {str(p.target) && <Row label="Target" value={str(p.target)} />}
          <Row
            label="Resist (RM)"
            value={p.rm_applies === true ? "Yes" : p.rm_applies === false ? "No" : ""}
          />
          <Row
            label="House spell"
            value={
              p.is_house_spell === true
                ? "Yes"
                : p.is_house_spell === false
                  ? "No"
                  : ""
            }
          />
          {traditions.length > 0 && (
            <Row label="Traditions" value={<Tags items={traditions} />} />
          )}
        </div>
      </div>

      {str(p.description_source) && (
        <p className="text-xs text-ink-faint">
          Text source:{" "}
          <a
            href={str(p.description_source)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-light hover:underline break-all"
          >
            {str(p.description_source)}
          </a>
        </p>
      )}

      <Source src={p.source} />
    </div>
  );
}

// ─── Race ────────────────────────────────────────────────────────────────────

function RaceDetail({ p }: { p: Record<string, unknown> }) {
  const attrMod =
    typeof p.attribute_modifiers === "object" && p.attribute_modifiers
      ? (p.attribute_modifiers as Record<string, unknown>)
      : null;
  const derivedMod =
    typeof p.derived_modifiers === "object" && p.derived_modifiers
      ? (p.derived_modifiers as Record<string, unknown>)
      : null;
  const autoAdv = Array.isArray(p.automatic_advantages)
    ? (p.automatic_advantages as unknown[])
    : [];
  const cultures = Array.isArray(p.allowed_cultures)
    ? (p.allowed_cultures as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed">{str(p.description)}</p>
      )}
      {p.gp_cost != null && <Row label="GP Cost" value={str(p.gp_cost)} />}
      {attrMod && Object.keys(attrMod).length > 0 && (
        <Row label="Attr. Modifiers" value={<ObjTable obj={attrMod} />} />
      )}
      {derivedMod && Object.keys(derivedMod).length > 0 && (
        <Row label="Derived Modifiers" value={<ObjTable obj={derivedMod} />} />
      )}
      {str(p.magic_status) && (
        <Row label="Magic Status" value={str(p.magic_status)} />
      )}
      {autoAdv.length > 0 && (
        <Row label="Auto Advantages" value={<Tags items={autoAdv} />} />
      )}
      {cultures.length > 0 && (
        <Row label="Cultures" value={<Tags items={cultures} />} />
      )}
      <Source src={p.source} />
    </div>
  );
}

// ─── Culture ─────────────────────────────────────────────────────────────────

function CultureDetail({ p }: { p: Record<string, unknown> }) {
  const races = Array.isArray(p.allowed_races)
    ? (p.allowed_races as unknown[])
    : [];
  const autoAdv = Array.isArray(p.automatic_advantages)
    ? (p.automatic_advantages as unknown[])
    : [];
  const affinity = Array.isArray(p.affinity_tags)
    ? (p.affinity_tags as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed">{str(p.description)}</p>
      )}
      {p.gp_cost != null && <Row label="GP Cost" value={str(p.gp_cost)} />}
      {races.length > 0 && (
        <Row label="Races" value={<Tags items={races} />} />
      )}
      {autoAdv.length > 0 && (
        <Row label="Auto Advantages" value={<Tags items={autoAdv} />} />
      )}
      {affinity.length > 0 && (
        <Row label="Affinity" value={<Tags items={affinity} />} />
      )}
      <Source src={p.source} />
    </div>
  );
}

// ─── Profession ──────────────────────────────────────────────────────────────

function ProfessionDetail({ p }: { p: Record<string, unknown> }) {
  const autoAdv = Array.isArray(p.automatic_advantages)
    ? (p.automatic_advantages as unknown[])
    : [];
  const affinity = Array.isArray(p.affinity_tags)
    ? (p.affinity_tags as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed">{str(p.description)}</p>
      )}
      {p.gp_cost != null && <Row label="GP Cost" value={str(p.gp_cost)} />}
      {str(p.magical_status) && (
        <Row label="Magical Status" value={str(p.magical_status)} />
      )}
      {autoAdv.length > 0 && (
        <Row label="Auto Advantages" value={<Tags items={autoAdv} />} />
      )}
      {affinity.length > 0 && (
        <Row label="Affinity" value={<Tags items={affinity} />} />
      )}
      <Source src={p.source} />
    </div>
  );
}

// ─── Talent ──────────────────────────────────────────────────────────────────

function TalentDetail({ p }: { p: Record<string, unknown> }) {
  const attrs = Array.isArray(p.test_attributes)
    ? (p.test_attributes as string[]).join(" / ")
    : "";
  const specializations = Array.isArray(p.specializations)
    ? (p.specializations as unknown[])
    : [];
  const related = Array.isArray(p.related_talents)
    ? (p.related_talents as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed">{str(p.description)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {attrs && <Stat label="Test" value={attrs} />}
        {str(p.advancement_column) && (
          <Stat label="Column" value={str(p.advancement_column)} />
        )}
        {p.eec != null && <Stat label="EEC" value={str(p.eec)} />}
      </div>
      {specializations.length > 0 && (
        <Row
          label="Specializations"
          value={<Tags items={specializations} />}
        />
      )}
      {related.length > 0 && (
        <Row label="Related Talents" value={<Tags items={related} />} />
      )}
      <Source src={p.source} />
    </div>
  );
}

// ─── Equipment ───────────────────────────────────────────────────────────────

function EquipmentDetail({
  p,
  fileKey,
}: {
  p: Record<string, unknown>;
  fileKey: string;
}) {
  if (fileKey === "weapons") {
    const compatTalents = Array.isArray(p.compatible_talents)
      ? (p.compatible_talents as unknown[])
      : [];
    const hasEkSpan =
      p.distance_class_min != null && p.distance_class_max != null;
    return (
      <div className="space-y-2">
        {str(p.description) && (
          <p className="text-ink text-sm">{str(p.description)}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {str(p.category) && (
            <Stat
              label="Category"
              value={str(p.category).replace(/_/g, " ")}
            />
          )}
          {str(p.damage) && <Stat label="Damage" value={str(p.damage)} />}
          {p.at_modifier != null && (
            <Stat label="AT Mod" value={str(p.at_modifier)} />
          )}
          {p.pa_modifier != null && (
            <Stat label="PA Mod" value={str(p.pa_modifier)} />
          )}
          {str(p.reach_class) && (
            <Stat label="Reach" value={str(p.reach_class)} />
          )}
          {p.ini_modifier != null && (
            <Stat label="INI Mod" value={str(p.ini_modifier)} />
          )}
          {hasEkSpan && (
            <Stat
              label="EK span"
              value={`${p.distance_class_min}–${p.distance_class_max}`}
            />
          )}
          {str(p.weight) && <Stat label="Weight" value={str(p.weight)} />}
          {str(p.cost) && <Stat label="Cost" value={str(p.cost)} />}
        </div>
        <WeaponRangeBandsBlock p={p} />
        {str(p.notes) && <Row label="Notes" value={str(p.notes)} />}
        {str(p.special) && <Row label="Special" value={str(p.special)} />}
        {str(p.combat_talent) && (
          <Row
            label="Combat Talent"
            value={str(p.combat_talent).replace(/_/g, " ")}
          />
        )}
        {compatTalents.length > 0 && (
          <Row
            label="Compatible Talents"
            value={<Tags items={compatTalents} />}
          />
        )}
        <Source src={p.source} />
      </div>
    );
  }

  if (fileKey === "armor") {
    const coverage = Array.isArray(p.coverage)
      ? (p.coverage as unknown[])
      : null;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {p.ar != null && <Stat label="AR" value={str(p.ar)} />}
          {p.ec != null && <Stat label="EC" value={str(p.ec)} />}
          {p.ini_modifier != null && (
            <Stat label="INI Mod" value={str(p.ini_modifier)} />
          )}
          {str(p.weight) && <Stat label="Weight" value={str(p.weight)} />}
          {str(p.cost) && <Stat label="Cost" value={str(p.cost)} />}
        </div>
        {coverage && coverage.length > 0 && (
          <Row label="Coverage" value={<Tags items={coverage} />} />
        )}
        {!coverage && str(p.coverage) && (
          <Row label="Coverage" value={str(p.coverage)} />
        )}
        {str(p.special) && <Row label="Special" value={str(p.special)} />}
        <Source src={p.source} />
      </div>
    );
  }

  // general_equipment
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm">{str(p.description)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {str(p.weight) && <Stat label="Weight" value={str(p.weight)} />}
        {str(p.cost) && <Stat label="Cost" value={str(p.cost)} />}
        {str(p.category) && (
          <Stat
            label="Category"
            value={str(p.category).replace(/_/g, " ")}
          />
        )}
      </div>
      <Source src={p.source} />
    </div>
  );
}

// ─── Character trait ──────────────────────────────────────────────────────────

function CharacterTraitDetail({ p }: { p: Record<string, unknown> }) {
  const effects = Array.isArray(p.effects)
    ? (p.effects as Array<{ type?: string; description?: string }>)
    : [];
  const prereqs = Array.isArray(p.prerequisites)
    ? (p.prerequisites as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed">{str(p.description)}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {p.gp_cost != null && (
          <Stat label="GP Cost" value={str(p.gp_cost)} />
        )}
        {p.ap_cost != null && (
          <Stat label="AP Cost" value={str(p.ap_cost)} />
        )}
        {p.gp_refund_per_point != null && (
          <Stat label="GP Refund/pt" value={str(p.gp_refund_per_point)} />
        )}
        {p.is_leveled === true && <Stat label="Leveled" value="yes" />}
      </div>
      {effects.length > 0 && (
        <div className="mt-2 space-y-1">
          {effects.map((eff, i) => (
            <div key={i} className="text-sm">
              {eff.type && (
                <span className="text-ink-muted mr-2 capitalize">
                  {eff.type.replace(/_/g, " ")}:
                </span>
              )}
              <span className="text-ink">{eff.description}</span>
            </div>
          ))}
        </div>
      )}
      {prereqs.length > 0 && (
        <Row label="Prerequisites" value={<Tags items={prereqs} />} />
      )}
      <Source src={p.source} />
    </div>
  );
}

// ─── Combat Maneuver ──────────────────────────────────────────────────────────

function CombatManeuverDetail({ p }: { p: Record<string, unknown> }) {
  const compatTalents = Array.isArray(p.compatible_talents)
    ? (p.compatible_talents as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed">{str(p.description)}</p>
      )}
      {str(p.type) && (
        <Row label="Type" value={str(p.type).replace(/_/g, " ")} />
      )}
      {p.base_modifier != null && (
        <Row label="Base Modifier" value={str(p.base_modifier)} />
      )}
      {p.requires_sa === true && (
        <Row label="Requires SA" value={str(p.sa_requirement) || "yes"} />
      )}
      {compatTalents.length > 0 && (
        <Row
          label="Compatible Talents"
          value={<Tags items={compatTalents} />}
        />
      )}
      <Source src={p.source} />
    </div>
  );
}

// ─── Generic fallback ────────────────────────────────────────────────────────

function GenericDetail({ p }: { p: Record<string, unknown> }) {
  const skip = new Set(["id", "meta"]);
  return (
    <div>
      {str(p.description) && (
        <p className="text-ink text-sm leading-relaxed mb-3">
          {str(p.description)}
        </p>
      )}
      {Object.entries(p)
        .filter(([k]) => !skip.has(k) && k !== "description")
        .map(([k, v]) => (
          <Row
            key={k}
            label={k}
            value={
              Array.isArray(v) ? (
                <Tags items={v} />
              ) : typeof v === "object" && v !== null ? (
                <pre className="text-xs text-ink-muted whitespace-pre-wrap">
                  {JSON.stringify(v, null, 2)}
                </pre>
              ) : (
                String(v ?? "—")
              )
            }
          />
        ))}
    </div>
  );
}
