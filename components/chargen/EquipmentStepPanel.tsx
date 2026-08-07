"use client";

import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type {
  ArmorWert,
  HeldModel,
  MeleeWeaponWert,
  RangedWeaponWert,
  ShieldWert,
} from "@/lib/chargen/types";
import {
  armorWertFromCatalog,
  formatDk,
  formatHpSt,
  formatIntList,
  formatWm,
  MAX_ARMORS,
  MAX_MELEE_WEAPONS,
  MAX_RANGED_WEAPONS,
  MAX_SHIELDS,
  meleeWertFromCatalog,
  parseDk,
  parseHpSt,
  parseIntList,
  parseWm,
  rangedWertFromCatalog,
  shieldWertFromCatalog,
  SHIELD_TYPES,
  weaponTalentOptions,
} from "@/lib/chargen/rules/equipmentWert";

function fieldClass() {
  return "rounded border border-surface-border bg-surface-sidebar px-1.5 py-0.5 text-sm text-ink";
}

function labelClass() {
  return "text-[10px] uppercase tracking-wide text-ink-muted";
}

function CustomBadge({ source }: { source?: string }) {
  if (!source || source === "builtin") return null;
  return (
    <span className="ml-1 text-[10px] uppercase text-ink-faint">({source})</span>
  );
}

function catalogById(
  list: CatalogItem[],
  id: string
): CatalogItem | undefined {
  return list.find((x) => String(x.id) === id);
}

function MeleeCard({
  wert,
  index,
  catalog,
  talentName,
  onChange,
  onRemove,
}: {
  wert: MeleeWeaponWert;
  index: number;
  catalog: CatalogItem[];
  talentName: (id: string) => string;
  onChange: (index: number, next: MeleeWeaponWert) => void;
  onRemove: (index: number) => void;
}) {
  const item = catalogById(catalog, wert.id);
  const talents = weaponTalentOptions(item);
  return (
    <div className={"rounded-lg border border-surface-border p-3 space-y-2 bg-[#1a1410]"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">Melee #{index + 1}</span>
        <button
          type="button"
          className="text-xs text-ink-muted hover:text-ink underline"
          onClick={() => onRemove(index)}
        >
          Remove
        </button>
      </div>
      <label className="block space-y-0.5">
        <span className={labelClass()}>Name</span>
        <input
          className={`${fieldClass()} w-full`}
          value={wert.name ?? ""}
          onChange={(e) => onChange(index, { ...wert, name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-0.5">
          <span className={labelClass()}>Weapon</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.id}
            onChange={(e) => {
              const next = catalogById(catalog, e.target.value);
              if (next) onChange(index, meleeWertFromCatalog(next));
            }}
          >
            {catalog.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {(c.name as string) || String(c.id)}
              </option>
            ))}
          </select>
          <CustomBadge source={item?.source as string} />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>Talent</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.talent ?? talents[0] ?? ""}
            onChange={(e) =>
              onChange(index, { ...wert, talent: e.target.value || undefined })
            }
          >
            {talents.map((id) => (
              <option key={id} value={id}>
                {talentName(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="block space-y-0.5">
          <span className={labelClass()}>HP</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            value={wert.tp ?? ""}
            onChange={(e) => onChange(index, { ...wert, tp: e.target.value })}
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>HP/ST</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            defaultValue={formatHpSt(wert)}
            key={`hpst-${index}-${wert.damageThreshold}-${wert.damageStep}`}
            onBlur={(e) => {
              const parsed = parseHpSt(e.target.value);
              if (parsed) onChange(index, { ...wert, ...parsed });
              else e.target.value = formatHpSt(wert);
            }}
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>INI</span>
          <input
            type="number"
            className={`${fieldClass()} w-full font-mono`}
            value={wert.ini ?? 0}
            onChange={(e) =>
              onChange(index, { ...wert, ini: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>WM</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            defaultValue={formatWm(wert)}
            key={`wm-${index}-${wert.wmAt}-${wert.wmPa}`}
            onBlur={(e) => {
              const parsed = parseWm(e.target.value);
              if (parsed) onChange(index, { ...wert, ...parsed });
              else e.target.value = formatWm(wert);
            }}
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>BF</span>
          <input
            type="number"
            className={`${fieldClass()} w-full font-mono`}
            value={wert.bf ?? 0}
            onChange={(e) =>
              onChange(index, { ...wert, bf: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>DC</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            defaultValue={formatDk(wert)}
            key={`dk-${index}-${wert.dkH}-${wert.dkN}-${wert.dkS}`}
            onBlur={(e) =>
              onChange(index, { ...wert, ...parseDk(e.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
}

function RangedCard({
  wert,
  index,
  catalog,
  talentName,
  onChange,
  onRemove,
}: {
  wert: RangedWeaponWert;
  index: number;
  catalog: CatalogItem[];
  talentName: (id: string) => string;
  onChange: (index: number, next: RangedWeaponWert) => void;
  onRemove: (index: number) => void;
}) {
  const item = catalogById(catalog, wert.id);
  const talents = [...weaponTalentOptions(item)];
  if (item?.talent && !talents.includes(String(item.talent))) {
    talents.unshift(String(item.talent));
  }
  return (
    <div className={"rounded-lg border border-surface-border p-3 space-y-2 bg-[#1a1410]"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">Ranged #{index + 1}</span>
        <button
          type="button"
          className="text-xs text-ink-muted hover:text-ink underline"
          onClick={() => onRemove(index)}
        >
          Remove
        </button>
      </div>
      <label className="block space-y-0.5">
        <span className={labelClass()}>Name</span>
        <input
          className={`${fieldClass()} w-full`}
          value={wert.name ?? ""}
          onChange={(e) => onChange(index, { ...wert, name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-0.5">
          <span className={labelClass()}>Weapon</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.id}
            onChange={(e) => {
              const next = catalogById(catalog, e.target.value);
              if (next) onChange(index, rangedWertFromCatalog(next));
            }}
          >
            {catalog.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {(c.name as string) || String(c.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>Talent</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.talent ?? talents[0] ?? ""}
            onChange={(e) =>
              onChange(index, { ...wert, talent: e.target.value || undefined })
            }
          >
            {talents.map((id) => (
              <option key={id} value={id}>
                {talentName(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block space-y-0.5">
          <span className={labelClass()}>HP</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            value={wert.tp ?? ""}
            onChange={(e) => onChange(index, { ...wert, tp: e.target.value })}
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>Ranges</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            value={formatIntList(wert.ranges)}
            onChange={(e) =>
              onChange(index, { ...wert, ranges: parseIntList(e.target.value) })
            }
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>HP+</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            value={formatIntList(wert.tpPlus)}
            onChange={(e) =>
              onChange(index, { ...wert, tpPlus: parseIntList(e.target.value) })
            }
          />
        </label>
      </div>
    </div>
  );
}

function ArmorCard({
  wert,
  index,
  catalog,
  onChange,
  onRemove,
}: {
  wert: ArmorWert;
  index: number;
  catalog: CatalogItem[];
  onChange: (index: number, next: ArmorWert) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className={"rounded-lg border border-surface-border p-3 space-y-2 bg-[#1a1410]"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">Armor #{index + 1}</span>
        <button
          type="button"
          className="text-xs text-ink-muted hover:text-ink underline"
          onClick={() => onRemove(index)}
        >
          Remove
        </button>
      </div>
      <label className="block space-y-0.5">
        <span className={labelClass()}>Name</span>
        <input
          className={`${fieldClass()} w-full`}
          value={wert.name ?? ""}
          onChange={(e) => onChange(index, { ...wert, name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block space-y-0.5 sm:col-span-1">
          <span className={labelClass()}>Armor</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.id}
            onChange={(e) => {
              const next = catalogById(catalog, e.target.value);
              if (next) onChange(index, armorWertFromCatalog(next));
            }}
          >
            {catalog.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {(c.name as string) || String(c.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>AR</span>
          <input
            type="number"
            className={`${fieldClass()} w-full font-mono`}
            value={wert.rs ?? 0}
            onChange={(e) =>
              onChange(index, { ...wert, rs: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>EC</span>
          <input
            type="number"
            className={`${fieldClass()} w-full font-mono`}
            value={wert.be ?? 0}
            onChange={(e) =>
              onChange(index, { ...wert, be: Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>
    </div>
  );
}

function ShieldCard({
  wert,
  index,
  catalog,
  onChange,
  onRemove,
}: {
  wert: ShieldWert;
  index: number;
  catalog: CatalogItem[];
  onChange: (index: number, next: ShieldWert) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className={"rounded-lg border border-surface-border p-3 space-y-2 bg-[#1a1410]"}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted">Shield #{index + 1}</span>
        <button
          type="button"
          className="text-xs text-ink-muted hover:text-ink underline"
          onClick={() => onRemove(index)}
        >
          Remove
        </button>
      </div>
      <label className="block space-y-0.5">
        <span className={labelClass()}>Name</span>
        <input
          className={`${fieldClass()} w-full`}
          value={wert.name ?? ""}
          onChange={(e) => onChange(index, { ...wert, name: e.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <label className="block space-y-0.5 col-span-2 sm:col-span-1">
          <span className={labelClass()}>Shield</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.id}
            onChange={(e) => {
              const next = catalogById(catalog, e.target.value);
              if (next) onChange(index, shieldWertFromCatalog(next));
            }}
          >
            {catalog.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {(c.name as string) || String(c.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>Type</span>
          <select
            className={`${fieldClass()} w-full`}
            value={wert.type ?? SHIELD_TYPES[0]?.id ?? ""}
            onChange={(e) =>
              onChange(index, { ...wert, type: e.target.value || undefined })
            }
          >
            {SHIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
            {wert.type &&
              !SHIELD_TYPES.some((t) => t.id === wert.type) && (
                <option value={wert.type}>{wert.type}</option>
              )}
          </select>
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>INI</span>
          <input
            type="number"
            className={`${fieldClass()} w-full font-mono`}
            value={wert.ini ?? 0}
            onChange={(e) =>
              onChange(index, { ...wert, ini: Number(e.target.value) || 0 })
            }
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>WM</span>
          <input
            className={`${fieldClass()} w-full font-mono`}
            defaultValue={formatWm(wert)}
            key={`swm-${index}-${wert.wmAt}-${wert.wmPa}`}
            onBlur={(e) => {
              const parsed = parseWm(e.target.value);
              if (parsed) onChange(index, { ...wert, ...parsed });
              else e.target.value = formatWm(wert);
            }}
          />
        </label>
        <label className="block space-y-0.5">
          <span className={labelClass()}>BF</span>
          <input
            type="number"
            className={`${fieldClass()} w-full font-mono`}
            value={wert.bf ?? 0}
            onChange={(e) =>
              onChange(index, { ...wert, bf: Number(e.target.value) || 0 })
            }
          />
        </label>
      </div>
    </div>
  );
}

export default function EquipmentStepPanel({
  held,
  updateHeld,
  meleeCatalog,
  rangedCatalog,
  armorCatalog,
  shieldCatalog,
  talentName,
}: {
  held: HeldModel;
  updateHeld: (fn: (h: HeldModel) => HeldModel) => void;
  meleeCatalog: CatalogItem[];
  rangedCatalog: CatalogItem[];
  armorCatalog: CatalogItem[];
  shieldCatalog: CatalogItem[];
  talentName: (id: string) => string;
}) {
  const patchMelee = (index: number, next: MeleeWeaponWert) =>
    updateHeld((h) => {
      const arr = [...h.meleeWeapons];
      arr[index] = next;
      return { ...h, meleeWeapons: arr };
    });
  const patchRanged = (index: number, next: RangedWeaponWert) =>
    updateHeld((h) => {
      const arr = [...h.rangedWeapons];
      arr[index] = next;
      return { ...h, rangedWeapons: arr };
    });
  const patchArmor = (index: number, next: ArmorWert) =>
    updateHeld((h) => {
      const arr = [...h.armors];
      arr[index] = next;
      return { ...h, armors: arr };
    });
  const patchShield = (index: number, next: ShieldWert) =>
    updateHeld((h) => {
      const arr = [...h.shields];
      arr[index] = next;
      return { ...h, shields: arr };
    });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold">Equipment</h2>
        <p className="text-sm text-ink-muted mt-1">
          Add multiple items of the same type, rename them, and edit stats.
          Changing the catalog type resets defaults from the weapon/armor entry.
        </p>
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Melee weapons ({held.meleeWeapons.length}/{MAX_MELEE_WEAPONS})
          </h3>
          <button
            type="button"
            className="px-2 py-0.5 rounded border border-surface-border text-sm disabled:opacity-40"
            disabled={
              held.meleeWeapons.length >= MAX_MELEE_WEAPONS ||
              meleeCatalog.length === 0
            }
            onClick={() =>
              updateHeld((h) => {
                if (h.meleeWeapons.length >= MAX_MELEE_WEAPONS) return h;
                const first = meleeCatalog[0];
                if (!first) return h;
                return {
                  ...h,
                  meleeWeapons: [
                    ...h.meleeWeapons,
                    meleeWertFromCatalog(first),
                  ],
                };
              })
            }
          >
            Add
          </button>
        </div>
        <div className="space-y-3">
          {held.meleeWeapons.map((w, i) => (
            <MeleeCard
              key={`melee-${i}-${w.id}`}
              wert={w}
              index={i}
              catalog={meleeCatalog}
              talentName={talentName}
              onChange={patchMelee}
              onRemove={(index) =>
                updateHeld((h) => ({
                  ...h,
                  meleeWeapons: h.meleeWeapons.filter((_, j) => j !== index),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Ranged weapons ({held.rangedWeapons.length}/{MAX_RANGED_WEAPONS})
          </h3>
          <button
            type="button"
            className="px-2 py-0.5 rounded border border-surface-border text-sm disabled:opacity-40"
            disabled={
              held.rangedWeapons.length >= MAX_RANGED_WEAPONS ||
              rangedCatalog.length === 0
            }
            onClick={() =>
              updateHeld((h) => {
                if (h.rangedWeapons.length >= MAX_RANGED_WEAPONS) return h;
                const first = rangedCatalog[0];
                if (!first) return h;
                return {
                  ...h,
                  rangedWeapons: [
                    ...h.rangedWeapons,
                    rangedWertFromCatalog(first),
                  ],
                };
              })
            }
          >
            Add
          </button>
        </div>
        <div className="space-y-3">
          {held.rangedWeapons.map((w, i) => (
            <RangedCard
              key={`ranged-${i}-${w.id}`}
              wert={w}
              index={i}
              catalog={rangedCatalog}
              talentName={talentName}
              onChange={patchRanged}
              onRemove={(index) =>
                updateHeld((h) => ({
                  ...h,
                  rangedWeapons: h.rangedWeapons.filter((_, j) => j !== index),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Armor ({held.armors.length}/{MAX_ARMORS})
          </h3>
          <button
            type="button"
            className="px-2 py-0.5 rounded border border-surface-border text-sm disabled:opacity-40"
            disabled={
              held.armors.length >= MAX_ARMORS || armorCatalog.length === 0
            }
            onClick={() =>
              updateHeld((h) => {
                if (h.armors.length >= MAX_ARMORS) return h;
                const first = armorCatalog[0];
                if (!first) return h;
                return {
                  ...h,
                  armors: [...h.armors, armorWertFromCatalog(first)],
                };
              })
            }
          >
            Add
          </button>
        </div>
        <div className="space-y-3">
          {held.armors.map((w, i) => (
            <ArmorCard
              key={`armor-${i}-${w.id}`}
              wert={w}
              index={i}
              catalog={armorCatalog}
              onChange={patchArmor}
              onRemove={(index) =>
                updateHeld((h) => ({
                  ...h,
                  armors: h.armors.filter((_, j) => j !== index),
                }))
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Shields ({held.shields.length}/{MAX_SHIELDS})
          </h3>
          <button
            type="button"
            className="px-2 py-0.5 rounded border border-surface-border text-sm disabled:opacity-40"
            disabled={
              held.shields.length >= MAX_SHIELDS || shieldCatalog.length === 0
            }
            onClick={() =>
              updateHeld((h) => {
                if (h.shields.length >= MAX_SHIELDS) return h;
                const first = shieldCatalog[0];
                if (!first) return h;
                return {
                  ...h,
                  shields: [...h.shields, shieldWertFromCatalog(first)],
                };
              })
            }
          >
            Add
          </button>
        </div>
        <div className="space-y-3">
          {held.shields.map((w, i) => (
            <ShieldCard
              key={`shield-${i}-${w.id}`}
              wert={w}
              index={i}
              catalog={shieldCatalog}
              onChange={patchShield}
              onRemove={(index) =>
                updateHeld((h) => ({
                  ...h,
                  shields: h.shields.filter((_, j) => j !== index),
                }))
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
