import type { ReactNode } from "react";
import {
  WEAPON_RANGE_BAND_LABELS,
  WEAPON_RANGE_FK_BY_BAND,
  formatSignedMod,
  formatTpPlusCell,
} from "@/lib/combat/rangedBands";

interface Props {
  payload: Record<string, unknown>;
  category: string;
  fileKey: string;
  /** Full codex file object (when needed to resolve refs, e.g. common_rules_ref). */
  codexRaw?: Record<string, unknown>;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

/**
 * Multi-line prose from data (WdH-style `description` with `\\n` / blank lines).
 * Default block layout collapses newlines into spaces unless `whitespace-pre-wrap` is used.
 */
function CodexPreserveNewlinesDescription({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p
      className={[
        "text-ink text-sm leading-relaxed whitespace-pre-wrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {text}
    </p>
  );
}

/** Label for Tags chips — strings ids, or `{ id, rating?, note? }` from cultures/races/etc. */
function tagChipText(item: unknown): string {
  if (item == null || item === "") return "";
  if (
    typeof item === "string" ||
    typeof item === "number" ||
    typeof item === "boolean"
  )
    return String(item).replace(/_/g, " ");
  if (Array.isArray(item)) return "";
  if (typeof item === "object" && item !== null) {
    const o = item as Record<string, unknown>;
    const pickOnes = o.pick_one_disadvantages;
    if (Array.isArray(pickOnes) && pickOnes.length > 0) {
      const opts = pickOnes
        .map((alt) =>
          typeof alt === "object" && alt !== null
            ? tagChipText(alt as Record<string, unknown>)
            : "",
        )
        .filter(Boolean);
      let line = opts.length ? `Pick one: ${opts.join(" · or · ")}` : "";
      if (typeof o.rating !== "undefined" && o.rating !== null && o.rating !== "") {
        const pr = `(rating ${String(o.rating)})`;
        line = line ? `${line} ${pr}` : pr;
      }
      if (typeof o.note === "string" && o.note.trim())
        line = line ? `${line} — ${o.note.trim()}` : o.note.trim();
      return line;
    }
    const idRaw = o.id;
    if (idRaw !== undefined && idRaw !== null && idRaw !== "") {
      let label = String(idRaw).replace(/_/g, " ");
      if (o.rating != null && o.rating !== "")
        label += ` (${String(o.rating)})`;
      if (typeof o.note === "string" && o.note.trim())
        label += ` — ${o.note.trim()}`;
      return label;
    }
    if (typeof o.note === "string" && o.note.trim()) return o.note.trim();
    try {
      return JSON.stringify(o);
    } catch {
      return String(item);
    }
  }
  return String(item).replace(/_/g, " ");
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
  const chips = items.map(tagChipText).filter((x) => x !== "");
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((text, i) => (
        <span
          key={i}
          className="text-xs px-2 py-0.5 rounded bg-surface-border text-ink-muted"
        >
          {text}
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
                <th className="px-3 py-2 font-normal">HP+ (optional)</th>
              ) : null}
              <th className="px-3 py-2 font-normal">BRV mod</th>
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

export default function EntryDetail({
  payload,
  category,
  fileKey,
  codexRaw,
}: Props) {
  if (category === "alchemy" && fileKey === "recipes")
    return <AlchemyRecipeDetail p={payload} />;
  if (category === "bestiary" && fileKey === "summoned_creatures")
    return (
      <SummonedBeingDetail p={payload} codexRaw={codexRaw ?? null} />
    );
  if (category === "bestiary" && fileKey === "beasts")
    return <BestiaryDetail p={payload} />;
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
  const autoDis = Array.isArray(p.automatic_disadvantages)
    ? (p.automatic_disadvantages as unknown[])
    : [];
  const cultures = Array.isArray(p.allowed_cultures)
    ? (p.allowed_cultures as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
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
      {autoDis.length > 0 && (
        <Row label="Auto Disadvantages" value={<Tags items={autoDis} />} />
      )}
      {cultures.length > 0 && (
        <Row label="Cultures" value={<Tags items={cultures} />} />
      )}
      {str(p.chargen_culture_bridge_note) && (
        <p className="text-xs text-amber-200/90 rounded border border-amber-800/50 bg-amber-950/30 px-2 py-1.5">
          {str(p.chargen_culture_bridge_note)}
        </p>
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
  const autoDis = Array.isArray(p.automatic_disadvantages)
    ? (p.automatic_disadvantages as unknown[])
    : [];
  const recAdv = Array.isArray(p.recommended_advantages)
    ? (p.recommended_advantages as unknown[])
    : [];
  const recDis = Array.isArray(p.recommended_disadvantages)
    ? (p.recommended_disadvantages as unknown[])
    : [];
  const unsuitAdv = Array.isArray(p.unsuitable_advantages)
    ? (p.unsuitable_advantages as unknown[])
    : [];
  const unsuitDis = Array.isArray(p.unsuitable_disadvantages)
    ? (p.unsuitable_disadvantages as unknown[])
    : [];
  const affinity = Array.isArray(p.affinity_tags)
    ? (p.affinity_tags as unknown[])
    : [];
  const cultureTags = Array.isArray(p.culture_tags)
    ? (p.culture_tags as unknown[])
    : [];
  const variantTags = Array.isArray(p.variant_tags)
    ? (p.variant_tags as unknown[])
    : [];
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
      )}
      {p.gp_cost != null && <Row label="GP Cost" value={str(p.gp_cost)} />}
      {races.length > 0 && (
        <Row label="Races" value={<Tags items={races} />} />
      )}
      {cultureTags.length > 0 && (
        <Row label="Culture tags" value={<Tags items={cultureTags} />} />
      )}
      {variantTags.length > 0 && (
        <Row label="Variant tags" value={<Tags items={variantTags} />} />
      )}
      {autoAdv.length > 0 && (
        <Row label="Auto Advantages" value={<Tags items={autoAdv} />} />
      )}
      {autoDis.length > 0 && (
        <Row label="Auto Disadvantages" value={<Tags items={autoDis} />} />
      )}
      {recAdv.length > 0 && (
        <Row label="Recommended advantages" value={<Tags items={recAdv} />} />
      )}
      {recDis.length > 0 && (
        <Row
          label="Recommended disadvantages"
          value={<Tags items={recDis} />}
        />
      )}
      {unsuitAdv.length > 0 && (
        <Row
          label="Unsuitable advantages"
          value={<Tags items={unsuitAdv} />}
        />
      )}
      {unsuitDis.length > 0 && (
        <Row
          label="Unsuitable disadvantages"
          value={<Tags items={unsuitDis} />}
        />
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
  const autoDis = Array.isArray(p.automatic_disadvantages)
    ? (p.automatic_disadvantages as unknown[])
    : [];
  const autoSas = Array.isArray(p.automatic_SAs)
    ? (p.automatic_SAs as unknown[])
    : [];
  const discSas = Array.isArray(p.discounted_SAs)
    ? (p.discounted_SAs as unknown[])
    : [];
  const affinity = Array.isArray(p.affinity_tags)
    ? (p.affinity_tags as unknown[])
    : [];
  const equipment = Array.isArray(p.starting_equipment)
    ? (p.starting_equipment as unknown[])
    : [];
  const variants = Array.isArray(p.variants) ? (p.variants as unknown[]) : [];
  const reqs = Array.isArray(p.requirements)
    ? (p.requirements as Array<Record<string, unknown>>)
    : [];
  const talentMods =
    p.talent_modifiers && typeof p.talent_modifiers === "object"
      ? (p.talent_modifiers as Record<string, unknown>)
      : {};
  const soReq = reqs.find((r) => r.type === "SO_range");
  const attrReqs = reqs.filter((r) => r.type === "attr_min");

  return (
    <div className="space-y-2">
      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
      )}
      {str(p.category) && (
        <Row label="Category" value={str(p.category).replace(/_/g, " ")} />
      )}
      {p.gp_cost != null && <Row label="GP Cost" value={str(p.gp_cost)} />}
      {p.time_consuming === true && (
        <Row label="Training" value="Time-consuming" />
      )}
      {str(p.magical_status) && (
        <Row label="Magical Status" value={str(p.magical_status)} />
      )}
      {soReq && (
        <Row
          label="Social Standing"
          value={`${str(soReq.min)}–${str(soReq.max)}`}
        />
      )}
      {attrReqs.length > 0 && (
        <Row
          label="Attribute mins"
          value={attrReqs
            .map((r) => `${str(r.attr)} ${str(r.value)}`)
            .join(", ")}
        />
      )}
      {Object.keys(talentMods).length > 0 && (
        <Row
          label="Talent package"
          value={
            <span className="text-sm">
              {Object.entries(talentMods)
                .map(([id, v]) => `${id.replace(/_/g, " ")} +${String(v)}`)
                .join(", ")}
            </span>
          }
        />
      )}
      {autoAdv.length > 0 && (
        <Row label="Auto Advantages" value={<Tags items={autoAdv} />} />
      )}
      {autoDis.length > 0 && (
        <Row label="Auto Disadvantages" value={<Tags items={autoDis} />} />
      )}
      {autoSas.length > 0 && (
        <Row label="Automatic SAs" value={<Tags items={autoSas} />} />
      )}
      {discSas.length > 0 && (
        <Row label="Discounted SAs" value={<Tags items={discSas} />} />
      )}
      {equipment.length > 0 && (
        <Row
          label="Starting equipment"
          value={
            <span className="text-sm">
              {equipment.map((e) => String(e)).join("; ")}
            </span>
          }
        />
      )}
      {str(p.special_possession) && (
        <Row label="Special Possession" value={str(p.special_possession)} />
      )}
      {affinity.length > 0 && (
        <Row label="Affinity" value={<Tags items={affinity} />} />
      )}
      <Row
        label="Variants"
        value={
          variants.length === 0
            ? "Base only (academy/unit variants in a later pass)"
            : `${variants.length} variant(s)`
        }
      />
      {p.data_complete === false && str(p.data_notes) && (
        <Row label="Data notes" value={str(p.data_notes)} />
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
        <CodexPreserveNewlinesDescription text={str(p.description)} />
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
          <CodexPreserveNewlinesDescription text={str(p.description)} />
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
        {str(p.notes) && (
          <Row
            label="Notes"
            value={
              <span className="whitespace-pre-wrap">{str(p.notes)}</span>
            }
          />
        )}
        {str(p.special) && (
          <Row
            label="Special"
            value={
              <span className="whitespace-pre-wrap">{str(p.special)}</span>
            }
          />
        )}
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
        {str(p.description) && (
          <CodexPreserveNewlinesDescription text={str(p.description)} />
        )}
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
          <Row
            label="Coverage"
            value={
              <span className="whitespace-pre-wrap">{str(p.coverage)}</span>
            }
          />
        )}
        {str(p.special) && (
          <Row
            label="Special"
            value={
              <span className="whitespace-pre-wrap">{str(p.special)}</span>
            }
          />
        )}
        <Source src={p.source} />
      </div>
    );
  }

  // general_equipment
  return (
    <div className="space-y-2">
      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
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
        <CodexPreserveNewlinesDescription text={str(p.description)} />
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
              <span className="text-ink whitespace-pre-wrap">
                {eff.description}
              </span>
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

// ─── Wege der Zauberei summons ──────────────────────────────────────────────

/** Category keys from data/bestiary/summoned_creatures.json */
const SUMMON_KIND_LABELS: Record<string, string> = {
  elemental: "Elementals",
  spirit: "Spirits",
  golem: "Golems",
  demon: "Demons",
  undead: "Undead",
  chimera_or_daimonid: "Chimeras / daimonids",
};

const SUMMON_STAT_KEYS = [
  "INI",
  "PA",
  "VP",
  "EP",
  "ASP",
  "AR",
  "speed",
  "RM",
  "GW",
  "CN",
] as const;

/** Display labels for stat keys stored in data (GW, speed) without changing JSON field names. */
const STAT_KEY_LABELS: Record<string, string> = {
  GW: "TH",
  speed: "SD",
};

function formatStatKeyLabel(key: string): string {
  return STAT_KEY_LABELS[key] ?? key;
}

function formatSummonCategory(cat: unknown): string {
  const k = String(cat ?? "").trim();
  return (SUMMON_KIND_LABELS[k] ?? k.replace(/_/g, " ")) || "—";
}

function getByDotPath(doc: Record<string, unknown>, refPath: string): unknown {
  const parts = refPath
    .trim()
    .replace(/^\.+/, "")
    .split(".")
    .filter(Boolean);
  let cur: unknown = doc;
  for (const key of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function SharedRulesFromMeta({ blob }: { blob: Record<string, unknown> }) {
  const common = blob.common_rules;
  const bullets = Array.isArray(common)
    ? (common as unknown[]).filter((x) => x != null)
    : null;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-border/20 px-3 py-2 mt-2 text-sm space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Shared rules (WdZ excerpt)
      </p>
      {str(blob.entity_type) && (
        <p className="text-ink-muted text-xs">
          Type: {str(blob.entity_type).replace(/_/g, " ")}
        </p>
      )}
      {bullets && bullets.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1 text-ink text-sm leading-relaxed">
          {bullets.map((b, i) => (
            <li key={i}>{String(b)}</li>
          ))}
        </ul>
      ) : null}
      {typeof blob.talents_by_rank === "object" &&
      blob.talents_by_rank !== null ? (
        <div>
          <p className="text-xs uppercase text-ink-muted mb-1">
            Talents by rank
          </p>
          <pre className="text-xs text-ink-muted whitespace-pre-wrap">
            {JSON.stringify(blob.talents_by_rank, null, 2)}
          </pre>
        </div>
      ) : null}
      {typeof blob.spellcasting_by_rank === "object" &&
      blob.spellcasting_by_rank !== null ? (
        <div>
          <p className="text-xs uppercase text-ink-muted mb-1">
            Spellcasting by rank
          </p>
          <pre className="text-xs text-ink-muted whitespace-pre-wrap">
            {JSON.stringify(blob.spellcasting_by_rank, null, 2)}
          </pre>
        </div>
      ) : null}
      {blob.medium_humanoid_golem_base_values != null ? (
        <p className="text-xs text-ink-muted italic">
          Golem base materials appear in codex meta (common_rules.golems); open
          the JSON or consult WdZ for full tables.
        </p>
      ) : null}
    </div>
  );
}

function SummonedBeingDetail({
  p,
  codexRaw,
}: {
  p: Record<string, unknown>;
  codexRaw: Record<string, unknown> | null;
}) {
  const attacks = Array.isArray(p.attacks)
    ? (p.attacks as Record<string, unknown>[])
    : [];
  const invocation =
    typeof p.invocation === "object" && p.invocation !== null
      ? (p.invocation as Record<string, unknown>)
      : null;
  const rawStats =
    typeof p.stats === "object" && p.stats !== null && !Array.isArray(p.stats)
      ? (p.stats as Record<string, unknown>)
      : null;

  const statsOrderKeys = SUMMON_STAT_KEYS as readonly string[];
  const statCells: { k: string; v: string }[] = [];
  if (rawStats) {
    for (const key of SUMMON_STAT_KEYS) {
      const v = rawStats[key];
      if (v == null || v === "") continue;
      statCells.push({
        k: key,
        v:
          typeof v === "object" && !Array.isArray(v)
            ? JSON.stringify(v)
            : String(v),
      });
    }
    for (const key of Object.keys(rawStats).filter((k) => !statsOrderKeys.includes(k))) {
      const v = rawStats[key];
      if (v == null || v === "") continue;
      statCells.push({
        k: key,
        v:
          typeof v === "object" && !Array.isArray(v)
            ? JSON.stringify(v)
            : String(v),
      });
    }
  }

  const ref = str(p.common_rules_ref).trim();
  let sharedBlob: Record<string, unknown> | null = null;
  if (ref && codexRaw != null) {
    const blob = getByDotPath(codexRaw, ref);
    if (blob && typeof blob === "object" && !Array.isArray(blob))
      sharedBlob = blob as Record<string, unknown>;
  }

  return (
    <div className="space-y-3">
      {p.needs_data_review === true && (
        <div className="rounded-md border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/95">
          This row was OCR-derived or flagged in the extraction; verify against
          Wege der Zauberei before relying on stats or services at the table.
        </div>
      )}

      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
      )}

      <Row label="Kind" value={formatSummonCategory(p.category)} />
      <Row label="English name" value={str(p.name)} />
      {str(p.german_name) && str(p.german_name) !== str(p.name) ? (
        <Row label="German name" value={str(p.german_name)} />
      ) : null}
      <Row
        label="Rank"
        value={str(p.rank) ? str(p.rank).replace(/_/g, " ") : ""}
      />
      <Row
        label="Element"
        value={str(p.element) ? str(p.element).replace(/_/g, " ") : ""}
      />

      {typeof p.source_page === "number" ? (
        <Row label="WdZ page (approx.)" value={String(p.source_page)} />
      ) : null}

      {invocation && Object.keys(invocation).length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Invocation modifiers
          </p>
          {Object.entries(invocation).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </div>
      ) : null}

      {statCells.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">
            Statistics
          </p>
          <div className="flex flex-wrap gap-2">
            {statCells.map(({ k, v }) => (
              <Stat key={k} label={formatStatKeyLabel(k)} value={v} />
            ))}
          </div>
        </div>
      ) : null}

      {attacks.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">
            Attacks
          </p>
          <div className="rounded-lg border border-surface-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-ink-muted">
                  <th className="px-3 py-2 font-normal">Name</th>
                  <th className="px-3 py-2 font-normal">DC</th>
                  <th className="px-3 py-2 font-normal">AT</th>
                  <th className="px-3 py-2 font-normal">Damage</th>
                </tr>
              </thead>
              <tbody>
                {attacks.map((a, i) => (
                  <tr key={i} className="border-b border-surface-border last:border-0">
                    <td className="px-3 py-1.5 text-ink">{str(a.name) || "—"}</td>
                    <td className="px-3 py-1.5 text-ink-muted">
                      {str(a.distance_class) || "—"}
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {a.AT != null ? String(a.AT) : "—"}
                    </td>
                    <td className="px-3 py-1.5">{str(a.damage) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Row
        label="Traits / specials"
        value={
          Array.isArray(p.special_properties) ? (
            <Tags items={p.special_properties as unknown[]} />
          ) : null
        }
      />

      <Row
        label="Possible services"
        value={
          Array.isArray(p.possible_services) ? (
            <Tags items={p.possible_services as unknown[]} />
          ) : null
        }
      />

      {ref ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Shared rules
          </p>
          {sharedBlob ? (
            <SharedRulesFromMeta blob={sharedBlob} />
          ) : (
            <p className="text-xs text-ink-muted italic">{ref}</p>
          )}
        </div>
      ) : null}

      <Source src={p.source} />
    </div>
  );
}

// ─── Bestiary ───────────────────────────────────────────────────────────────

const STAT_PRIMARY_KEYS = [
  "INI",
  "PA",
  "VP",
  "AR",
  "CN",
  "speed",
  "EP",
  "RM",
  "GW",
  "AT",
  "damage",
] as const;

function BestiaryDetail({ p }: { p: Record<string, unknown> }) {
  const rawStats =
    typeof p.stats === "object" && p.stats !== null && !Array.isArray(p.stats)
      ? (p.stats as Record<string, unknown>)
      : null;
  const attrBlock =
    rawStats &&
    typeof rawStats.attributes === "object" &&
    rawStats.attributes !== null &&
    !Array.isArray(rawStats.attributes)
      ? (rawStats.attributes as Record<string, unknown>)
      : null;
  const statCells: { k: string; v: string }[] = [];
  if (rawStats) {
    for (const key of STAT_PRIMARY_KEYS) {
      const v = rawStats[key];
      if (v == null || v === "") continue;
      statCells.push({ k: key, v: String(v) });
    }
    const extra = Object.keys(rawStats).filter(
      (k) => k !== "attributes" && !STAT_PRIMARY_KEYS.includes(k as (typeof STAT_PRIMARY_KEYS)[number]),
    );
    for (const key of extra) {
      const v = rawStats[key];
      if (v == null || v === "") continue;
      statCells.push({ k: key, v: typeof v === "object" ? JSON.stringify(v) : String(v) });
    }
  }

  const physical =
    typeof p.physical === "object" &&
    p.physical !== null &&
    !Array.isArray(p.physical)
      ? (p.physical as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-3">
      {p.needs_data_review === true && (
        <div className="rounded-md border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/95">
          Auto-extracted stats on this entry look incomplete or malformed; verify
          against the printed stat block before play.
        </div>
      )}

      {str(p.parent_group_name) && (
        <Row label="Category" value={str(p.parent_group_name)} />
      )}

      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
      )}

      {typeof p.source_page === "number" ? (
        <Row label="PDF page (approx.)" value={String(p.source_page)} />
      ) : null}

      {(str(p.distribution) || str(p.appearance)) && (
        <div className="space-y-0">
          {str(p.distribution) ? (
            <Row
              label="Distribution"
              value={
                <span className="whitespace-pre-wrap">
                  {str(p.distribution)}
                </span>
              }
            />
          ) : null}
          {str(p.appearance) ? (
            <Row
              label="Appearance"
              value={
                <span className="whitespace-pre-wrap">
                  {str(p.appearance)}
                </span>
              }
            />
          ) : null}
        </div>
      )}

      {physical && Object.keys(physical).length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Physical
          </p>
          {Object.entries(physical).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </div>
      ) : null}

      {statCells.length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">
            Combat statistics
          </p>
          <div className="flex flex-wrap gap-2">
            {statCells.map(({ k, v }) => (
              <Stat key={k} label={formatStatKeyLabel(k)} value={v} />
            ))}
          </div>
        </div>
      ) : null}

      {attrBlock && Object.keys(attrBlock).length > 0 ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Attributes
          </p>
          <ObjTable obj={attrBlock} />
        </div>
      ) : null}

      <Row
        label="Special combat"
        value={
          Array.isArray(p.special_combat_rules) ? (
            <Tags items={p.special_combat_rules as unknown[]} />
          ) : null
        }
      />
      <Row
        label="Special abilities"
        value={
          Array.isArray(p.special_abilities) ? (
            <Tags items={p.special_abilities as unknown[]} />
          ) : null
        }
      />

      {typeof p.loot === "object" && p.loot !== null && !Array.isArray(p.loot) ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Loot / use
          </p>
          {Object.entries(p.loot as Record<string, unknown>).map(([k, v]) => (
            <Row
              key={k}
              label={k}
              value={
                typeof v === "string" ? (
                  <span className="whitespace-pre-wrap">{v}</span>
                ) : (
                  String(v ?? "—")
                )
              }
            />
          ))}
        </div>
      ) : null}

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
        <CodexPreserveNewlinesDescription text={str(p.description)} />
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

// ─── Alchemy recipe ───────────────────────────────────────────────────────────

const ALCHEMY_CATEGORY_LABELS: Record<string, string> = {
  simple_alchemy: "Simple Alchemy",
  virtutica: "Elixirs of the Virtues",
  object_material_elixirs: "Object and Material Elixirs",
  poisons: "Poisons",
  remedies: "Remedies",
  mind_emotion_altered_states: "Mind, Emotion, and Altered States",
  rare_restorative_transformative:
    "Rare Restorative and Transformative Elixirs",
  ban_powders_spiritual:
    "Ban Powders, Summoning Aids, and Spiritual Preparations",
};

function AlchemyRecipeDetail({ p }: { p: Record<string, unknown> }) {
  const qualityM =
    typeof p.quality_m === "object" && p.quality_m !== null
      ? (p.quality_m as { effects?: number[]; note?: string; text?: string })
      : null;
  const tiers = Array.isArray(p.quality_tiers)
    ? (p.quality_tiers as Array<{ quality?: string; text?: string }>)
    : [];
  const adj =
    typeof p.quality_adjusted_prices === "object" &&
    p.quality_adjusted_prices !== null &&
    !Array.isArray(p.quality_adjusted_prices)
      ? (p.quality_adjusted_prices as Record<string, unknown>)
      : null;

  const catKey = str(p.category);
  const catLabel =
    str(p.category_label) ||
    ALCHEMY_CATEGORY_LABELS[catKey] ||
    catKey.replace(/_/g, " ");

  const brewAna = [
    p.brewing_modifier != null ? `${str(p.brewing_modifier)} Brewing` : "",
    p.analysis_modifier != null ? `${str(p.analysis_modifier)} Analysis` : "",
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="space-y-4">
      {p.no_standard_block === true && (
        <div className="rounded-md border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/95">
          No standard recipe block is published for this entry. The source
          withholds a complete formula or quality table.
        </div>
      )}

      {str(p.description) && (
        <CodexPreserveNewlinesDescription text={str(p.description)} />
      )}

      <div className="rounded-lg border border-surface-border bg-surface-sidebar/60 overflow-hidden">
        <div className="px-3 py-2 text-xs font-medium text-ink-muted border-b border-surface-border bg-surface-border/50">
          Crafting
        </div>
        <div className="px-3 py-2 space-y-0">
          {p.number != null && <Row label="Number" value={str(p.number)} />}
          {str(p.german_name) && str(p.german_name) !== str(p.name) && (
            <Row label="German name" value={str(p.german_name)} />
          )}
          {catLabel && <Row label="Category" value={catLabel} />}
          {str(p.ingredients) && (
            <Row
              label="Ingredients"
              value={
                <span className="whitespace-pre-wrap">{str(p.ingredients)}</span>
              }
            />
          )}
          {str(p.products) && (
            <Row
              label="Products"
              value={
                <span className="whitespace-pre-wrap">{str(p.products)}</span>
              }
            />
          )}
          {str(p.crafting_location) && (
            <Row label="Laboratory" value={str(p.crafting_location)} />
          )}
          {brewAna && <Row label="Modifiers" value={brewAna} />}
          {str(p.crafting_note) && (
            <Row
              label="Crafting note"
              value={
                <span className="whitespace-pre-wrap">
                  {str(p.crafting_note)}
                </span>
              }
            />
          )}
          {str(p.crafting_process) && (
            <Row
              label="Process"
              value={
                <span className="whitespace-pre-wrap">
                  {str(p.crafting_process)}
                </span>
              }
            />
          )}
        </div>
      </div>

      {str(p.effect) && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
            Effect
          </p>
          <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
            {str(p.effect)}
          </p>
        </div>
      )}

      {(qualityM || tiers.length > 0) && (
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-muted mb-2">
            Quality tiers
          </p>
          <div className="rounded-lg border border-surface-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-xs text-ink-muted bg-surface-border/50">
                  <th className="px-3 py-2 font-normal w-12">Q</th>
                  <th className="px-3 py-2 font-normal">Effect</th>
                </tr>
              </thead>
              <tbody>
                {qualityM && (
                  <tr className="border-b border-surface-border align-top">
                    <td className="px-3 py-1.5 text-ink font-medium">M</td>
                    <td className="px-3 py-1.5 text-ink">
                      {Array.isArray(qualityM.effects) &&
                      qualityM.effects.length > 0 ? (
                        <span>
                          Failed-batch effects{" "}
                          {qualityM.effects.join(", ")}
                          {qualityM.note ? (
                            <span className="text-ink-muted">
                              {" "}
                              — {qualityM.note}
                            </span>
                          ) : null}
                          <span className="block text-xs text-ink-faint mt-1">
                            See Alchemy → Failure Table
                          </span>
                        </span>
                      ) : (
                        <span className="whitespace-pre-wrap">
                          {str(qualityM.text) || str(qualityM.note) || "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                )}
                {tiers.map((t, i) => (
                  <tr
                    key={i}
                    className="border-b border-surface-border last:border-0 align-top"
                  >
                    <td className="px-3 py-1.5 text-ink font-medium">
                      {str(t.quality) || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-ink whitespace-pre-wrap">
                      {str(t.text) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {str(p.quality_tiers_note) && (
        <Row
          label="Quality tiers"
          value={
            <span className="whitespace-pre-wrap">
              {str(p.quality_tiers_note)}
            </span>
          }
        />
      )}

      {(str(p.hazard) ||
        str(p.damage_note) ||
        str(p.instability) ||
        str(p.additional_rule) ||
        str(p.important_note) ||
        str(p.shelf_life)) && (
        <div className="rounded-lg border border-surface-border overflow-hidden">
          <div className="px-3 py-2 text-xs font-medium text-ink-muted border-b border-surface-border bg-surface-border/50">
            Notes
          </div>
          <div className="px-3 py-2 space-y-0">
            {str(p.hazard) && (
              <Row
                label="Hazard"
                value={
                  <span className="whitespace-pre-wrap">{str(p.hazard)}</span>
                }
              />
            )}
            {str(p.damage_note) && (
              <Row
                label="Damage"
                value={
                  <span className="whitespace-pre-wrap">
                    {str(p.damage_note)}
                  </span>
                }
              />
            )}
            {str(p.instability) && (
              <Row
                label="Instability"
                value={
                  <span className="whitespace-pre-wrap">
                    {str(p.instability)}
                  </span>
                }
              />
            )}
            {str(p.additional_rule) && (
              <Row
                label="Additional rule"
                value={
                  <span className="whitespace-pre-wrap">
                    {str(p.additional_rule)}
                  </span>
                }
              />
            )}
            {str(p.important_note) && (
              <Row
                label="Important"
                value={
                  <span className="whitespace-pre-wrap">
                    {str(p.important_note)}
                  </span>
                }
              />
            )}
            {str(p.shelf_life) && (
              <Row label="Shelf life" value={str(p.shelf_life)} />
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-surface-border overflow-hidden">
        <div className="px-3 py-2 text-xs font-medium text-ink-muted border-b border-surface-border bg-surface-border/50">
          Prices
        </div>
        <div className="px-3 py-2 space-y-0">
          {str(p.market_price_quality_c) && (
            <Row
              label="Market (Quality C)"
              value={str(p.market_price_quality_c)}
            />
          )}
          {adj && Object.keys(adj).length > 0 && (
            <div className="py-2">
              <p className="text-xs text-ink-muted mb-1">
                Quality-adjusted market guideline
              </p>
              <div className="overflow-x-auto rounded border border-surface-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-xs text-ink-muted">
                      {["A", "B", "C", "D", "E", "F"].map((q) => (
                        <th key={q} className="px-2 py-1.5 font-normal">
                          {q}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {["A", "B", "C", "D", "E", "F"].map((q) => (
                        <td
                          key={q}
                          className="px-2 py-1.5 text-ink tabular-nums"
                        >
                          {adj[q] != null ? String(adj[q]) : "—"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {str(p.ingredient_cost) && (
            <Row label="Ingredient cost" value={str(p.ingredient_cost)} />
          )}
          {str(p.ingredient_price_note) && (
            <Row
              label="Ingredient note"
              value={
                <span className="whitespace-pre-wrap">
                  {str(p.ingredient_price_note)}
                </span>
              }
            />
          )}
          {p.availability != null && p.availability !== "" && (
            <Row label="Availability" value={str(p.availability)} />
          )}
        </div>
      </div>

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
        <CodexPreserveNewlinesDescription
          text={str(p.description)}
          className="mb-3"
        />
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
