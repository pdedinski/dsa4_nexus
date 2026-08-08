/**
 * Format-agnostic hero document model — Word-like bordered sheet layout.
 */

import talenteCatalog from "@/lib/chargen/data/talente.json";
import zauberCatalog from "@/lib/chargen/data/zauber.json";
import waffenNahkampf from "@/lib/chargen/data/waffen_nahkampf.json";
import waffenFernkampf from "@/lib/chargen/data/waffen_fernkampf.json";
import type { CatalogItem } from "@/lib/chargen/data/loadCatalog";
import type { AttributeMods, HeldModel } from "@/lib/chargen/types";
import {
  ATTR_LABELS,
  attributeModsSum,
  currentAttrValue,
  derivedValue,
} from "@/lib/chargen/types";
import { formatTalentProbe } from "@/lib/chargen/rules/talentCaps";
import { sktColumnLabel } from "@/lib/chargen/rules/kosten";
import { hasTrait } from "@/lib/chargen/rules/kosten";
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

export type Align = "left" | "center" | "right";
export type BorderStyle = "solid" | "none";

/** Body text — slightly larger to match Word sheet readability. */
const FS_BODY = 10;
/** Column headers (Talent / AT / PA / …) — same size as body, always bold. */
const FS_COL = 10;
/** Group title row inside a talent table. */
const FS_GROUP = 12;
/** Compact combat / attr column headers. */
const FS_COMPACT = 9;

export interface DocCell {
  text: string;
  bold?: boolean;
  fontSize?: number;
  align?: Align;
  colspan?: number;
}

export interface DocTable {
  kind: "table";
  widths: number[];
  rows: DocCell[][];
  /** When omitted, defaults to solid borders. */
  bordered?: boolean;
  borderStyle?: BorderStyle;
}

export interface DocHeading {
  kind: "heading";
  text: string;
  fontSize: number;
  align?: Align;
}

export interface DocPageBreak {
  kind: "pageBreak";
}

export interface DocColumns {
  kind: "columns";
  columns: { width: number; blocks: DocBlock[] }[];
}

export type DocBlock = DocHeading | DocTable | DocPageBreak | DocColumns;

export interface SheetDocument {
  title: string;
  blocks: DocBlock[];
}

function cell(text: string, opts: Partial<DocCell> = {}): DocCell {
  return { text: text ?? "", ...opts };
}

function table(
  widths: number[],
  rows: DocCell[][],
  opts: { bordered?: boolean; borderStyle?: BorderStyle } = {}
): DocTable {
  return {
    kind: "table",
    widths,
    rows,
    bordered: opts.bordered ?? true,
    borderStyle: opts.borderStyle ?? (opts.bordered === false ? "none" : "solid"),
  };
}

const TALENT_BY_ID = new Map(
  (talenteCatalog as CatalogItem[]).map((t) => [String(t.id), t])
);
const SPELL_BY_ID = new Map(
  (zauberCatalog as CatalogItem[]).map((s) => [String(s.id), s])
);
const MELEE_CATALOG = new Map(
  (waffenNahkampf as CatalogItem[]).map((w) => [String(w.id), w])
);
const RANGED_CATALOG = new Map(
  (waffenFernkampf as CatalogItem[]).map((w) => [String(w.id), w])
);

/** Export group labels — also used by the web sheet interpretation. */
export const SHEET_GROUP_LABELS: Record<string, string> = {
  combat: "Combat Talents",
  physical: "Physical Talents",
  social: "Social Talents",
  nature: "Nature Talents",
  knowledge: "Lore Talents",
  languages: "Languages",
  scripts: "Scripts",
  craft: "Artisan Talents",
  gifts: "Gifts",
  ritual_knowledge: "Ritual Lore",
  spells: "Spells",
};

const GROUP_LABELS = SHEET_GROUP_LABELS;

/** Left / right talent stacks (Word packing, no empty notes column). */
const TALENT_LEFT = [
  "combat",
  "physical",
  "social",
  "craft",
  "gifts",
  "ritual_knowledge",
] as const;
const TALENT_RIGHT = [
  "nature",
  "knowledge",
  "languages",
  "scripts",
] as const;

export const SHEET_TALENT_GROUP_ORDER = [
  "combat",
  "physical",
  "social",
  "nature",
  "knowledge",
  "languages",
  "scripts",
  "craft",
  "gifts",
  "ritual_knowledge",
] as const;

/** Filled rows + one blank for notes, capped at max (no long empty grids). */
function slotCount(filled: number, max: number): number {
  if (filled <= 0) return 1;
  return Math.min(max, filled + (filled < max ? 1 : 0));
}

const DERIVED_SHEET_LABELS: Record<string, string> = {
  VP: "Vitality",
  EP: "Endurance",
  RM: "Resistance to Magic",
  ASP: "Astral Energy",
  WT: "Wound Threshold",
  baseAT: "Base Attack Value",
  basePA: "Base Parry Value",
  baseBRV: "Base Ranged Value",
  baseINI: "Base Initiative Value",
};

const ELFISCHE_WELTSICHT = "VorNachteil.ElfischeWeltsicht";

/**
 * Java HeldExportRtf: `*` / `**` markers only when the hero has Elven Worldview
 * (lead talent / house spell / lead spell).
 */
export function sheetTalentLeadPrefix(held: HeldModel, talentId: string): string {
  if (!hasTrait(held, ELFISCHE_WELTSICHT)) return "";
  return held.leadTalents.includes(talentId) ? "* " : "";
}

export function sheetSpellNamePrefix(held: HeldModel, spellId: string): string {
  if (!hasTrait(held, ELFISCHE_WELTSICHT)) return "";
  if (held.houseSpells.includes(spellId)) return "** ";
  if (held.leadSpells.includes(spellId)) return "* ";
  return "";
}

function emptyCells(n: number): DocCell[] {
  return Array.from({ length: n }, () => cell(""));
}

function normalizeToSide(row: DocCell[], sideCols: number): DocCell[] {
  const spanSum = row.reduce((a, c) => a + (c.colspan ?? 1), 0);
  if (row.length === 1) {
    return [{ ...row[0], colspan: sideCols }];
  }
  const out = row.map((c) => ({ ...c }));
  let sum = spanSum;
  while (sum < sideCols) {
    out.push(cell(""));
    sum += 1;
  }
  return out;
}

function maxNativeCols(blocks: DocBlock[]): number {
  let max = 1;
  for (const b of blocks) {
    if (b.kind === "table") max = Math.max(max, b.widths.length);
  }
  return max;
}

function blocksToSideRows(blocks: DocBlock[], sideCols: number): DocCell[][] {
  const rows: DocCell[][] = [];
  for (const b of blocks) {
    if (b.kind === "heading") {
      rows.push([
        cell(b.text, {
          bold: true,
          align: "center",
          colspan: sideCols,
          fontSize: b.fontSize,
        }),
      ]);
      continue;
    }
    if (b.kind !== "table") continue;
    for (const row of b.rows) {
      rows.push(normalizeToSide(row, sideCols));
    }
  }
  return rows;
}

function sideWidthShares(sideCols: number, halfPct: number): number[] {
  if (sideCols <= 1) return [halfPct];
  const trail = sideCols - 1;
  const trailEach = Math.max(1, Math.floor((halfPct * 0.35) / trail));
  const trailTotal = trailEach * trail;
  return [halfPct - trailTotal, ...Array.from({ length: trail }, () => trailEach)];
}

/**
 * Flatten a two-column block into one wide table (Java chargen style).
 * Used by PDF/RTF so panes stay aligned across page breaks.
 */
export function zipDocColumns(block: DocColumns): DocTable | null {
  if (block.columns.length !== 2) return null;
  const leftBlocks = block.columns[0]?.blocks ?? [];
  const rightBlocks = block.columns[1]?.blocks ?? [];
  const sideCols = Math.max(
    maxNativeCols(leftBlocks),
    maxNativeCols(rightBlocks),
    3
  );
  const leftRows = blocksToSideRows(leftBlocks, sideCols);
  const rightRows = blocksToSideRows(rightBlocks, sideCols);
  const n = Math.max(leftRows.length, rightRows.length);
  if (n === 0) return null;

  const widths = [
    ...sideWidthShares(sideCols, 49),
    2,
    ...sideWidthShares(sideCols, 49),
  ];
  const rows: DocCell[][] = [];
  for (let i = 0; i < n; i++) {
    const L = leftRows[i] ?? emptyCells(sideCols);
    const R = rightRows[i] ?? emptyCells(sideCols);
    rows.push([...L, cell(""), ...R]);
  }
  return table(widths, rows);
}

function attributeStrip(held: HeldModel, mods?: AttributeMods): DocTable {
  // Match Java/Word mini strip: eight core attributes only (no SO), one cell each.
  const core = held.attributes.filter((a) => a.code !== "SO");
  const n = Math.max(core.length, 1);
  return table(
    Array(n).fill(100 / n),
    [
      core.map((a) =>
        cell(
          `${a.code}: ${currentAttrValue(held, a.code, mods)}`,
          { bold: true, align: "center", fontSize: FS_BODY }
        )
      ),
    ],
    { bordered: true, borderStyle: "solid" }
  );
}

function talentSktLabel(
  held: HeldModel,
  talent: CatalogItem | undefined
): string {
  if (!talent) return "";
  try {
    const col = resolveTalentSktColumn(held, talent);
    return sktColumnLabel(col);
  } catch {
    const raw = talent.skt_column;
    if (raw == null) return "";
    return sktColumnLabel(raw as string | number);
  }
}

function buildCombatTalentTable(
  held: HeldModel,
  groupId: string,
  tName: (id: string) => string
): DocTable | null {
  const rows: DocCell[][] = [
    [
      cell(GROUP_LABELS[groupId] || groupId, {
        bold: true,
        align: "center",
        colspan: 4,
        fontSize: FS_GROUP,
      }),
    ],
    [
      cell("Talent", { bold: true, fontSize: FS_COL }),
      cell("AT", { bold: true, align: "center", fontSize: FS_COL }),
      cell("PA", { bold: true, align: "center", fontSize: FS_COL }),
      cell("TP", { bold: true, align: "center", fontSize: FS_COL }),
    ],
  ];
  let count = 0;
  for (const tw of held.talents) {
    const meta = TALENT_BY_ID.get(tw.id);
    if (String(meta?.group || "") !== groupId) continue;
    count += 1;
    const skt = talentSktLabel(held, meta);
    const at = tw.attack ?? 0;
    const pa = Math.max(0, tw.tp - at);
    const label = `${sheetTalentLeadPrefix(held, tw.id)}${tName(tw.id)}${skt ? ` ${skt}` : ""}`;
    rows.push([
      cell(label, { fontSize: FS_BODY }),
      cell(String(at), { align: "center", fontSize: FS_BODY }),
      cell(String(pa), { align: "center", fontSize: FS_BODY }),
      cell(String(tw.tp), { align: "center", fontSize: FS_BODY }),
    ]);
  }
  if (count === 0) return null;
  return table([55, 15, 15, 15], rows);
}

function buildSkillTalentTable(
  held: HeldModel,
  groupId: string,
  tName: (id: string) => string,
  valueHeader: string
): DocTable | null {
  const rows: DocCell[][] = [
    [
      cell(GROUP_LABELS[groupId] || groupId, {
        bold: true,
        align: "center",
        colspan: 3,
        fontSize: FS_GROUP,
      }),
    ],
    [
      cell("Talent", { bold: true, fontSize: FS_COL }),
      cell("SKT", { bold: true, align: "center", fontSize: FS_COL }),
      cell(valueHeader, { bold: true, align: "center", fontSize: FS_COL }),
    ],
  ];
  let count = 0;
  for (const tw of held.talents) {
    const meta = TALENT_BY_ID.get(tw.id);
    if (String(meta?.group || "") !== groupId) continue;
    count += 1;
    const probe = meta ? formatTalentProbe(meta) : "";
    const skt = talentSktLabel(held, meta);
    const label = `${sheetTalentLeadPrefix(held, tw.id)}${tName(tw.id)}${probe ? ` ${probe}` : ""}`;
    rows.push([
      cell(label, { fontSize: FS_BODY }),
      cell(skt.replace(/[()]/g, "") || "", {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(String(tw.tp), { align: "center", fontSize: FS_BODY }),
    ]);
  }
  if (count === 0) return null;
  return table([70, 12, 18], rows);
}

function buildSpellsTable(
  held: HeldModel,
  sName: (id: string) => string
): DocTable | null {
  if (!held.spells.length) return null;
  const rows: DocCell[][] = [
    [
      cell("Spells", {
        bold: true,
        align: "center",
        colspan: 3,
        fontSize: FS_GROUP,
      }),
    ],
    [
      cell("Spell", { bold: true, fontSize: FS_COL }),
      cell("SKT", { bold: true, align: "center", fontSize: FS_COL }),
      cell("SP", { bold: true, align: "center", fontSize: FS_COL }),
    ],
  ];
  for (const sw of held.spells) {
    const meta = SPELL_BY_ID.get(sw.id);
    const markers = sheetSpellNamePrefix(held, sw.id);
    const probe = meta ? formatTalentProbe(meta) : "";
    let skt = "";
    if (meta?.skt_column != null) {
      skt = sktColumnLabel(meta.skt_column as string | number).replace(
        /[()]/g,
        ""
      );
    }
    const label = `${markers}${sName(sw.id)}${probe ? ` ${probe}` : ""}`;
    rows.push([
      cell(label, { fontSize: FS_BODY }),
      cell(skt, { align: "center", fontSize: FS_BODY }),
      cell(String(sw.sp), { align: "center", fontSize: FS_BODY }),
    ]);
  }
  return table([70, 12, 18], rows);
}

function groupBlocks(
  held: HeldModel,
  groupIds: readonly string[],
  tName: (id: string) => string,
  sName: (id: string) => string,
  includeSpells = false
): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const g of groupIds) {
    const tbl =
      g === "combat"
        ? buildCombatTalentTable(held, g, tName)
        : buildSkillTalentTable(held, g, tName, "TP");
    if (tbl) blocks.push(tbl);
  }
  if (includeSpells) {
    const spells = buildSpellsTable(held, sName);
    if (spells) blocks.push(spells);
  }
  return blocks;
}

function meleeMainTalents(weaponId: string): string[] {
  const cat = MELEE_CATALOG.get(weaponId);
  if (!cat) return [];
  const talents = cat.talents;
  if (Array.isArray(talents) && talents.length) return talents.map(String);
  if (cat.talent) return [String(cat.talent)];
  return [];
}

function rangedMainTalent(weaponId: string): string | undefined {
  const cat = RANGED_CATALOG.get(weaponId);
  return cat?.talent ? String(cat.talent) : undefined;
}

export function buildSheetDocument(
  held: HeldModel,
  names: {
    race?: string;
    culture?: string;
    profession?: string;
    talentName?: (id: string) => string;
    spellName?: (id: string) => string;
    traitName?: (id: string) => string;
    saName?: (id: string) => string;
    attributeMods?: AttributeMods;
  } = {}
): SheetDocument {
  const tName = names.talentName ?? ((id) => id);
  const sName = names.spellName ?? ((id) => id);
  const trName = names.traitName ?? ((id) => id);
  const saName = names.saName ?? ((id) => id);
  const attrMods = names.attributeMods;

  const blocks: DocBlock[] = [];
  const apCredit = Math.max(0, (held.apTotal || 0) - (held.apSpent || 0));

  blocks.push({
    kind: "heading",
    text: "TDE Character Sheet",
    fontSize: 22,
    align: "center",
  });

  blocks.push(
    table(
      [19, 81],
      [
        [cell("Name", { bold: true }), cell(held.name)],
        [cell("Race", { bold: true }), cell(names.race || held.raceId)],
        [cell("Culture", { bold: true }), cell(names.culture || held.cultureId)],
        [
          cell("Profession", { bold: true }),
          cell(names.profession || held.professionId),
        ],
      ]
    )
  );

  blocks.push(
    table(
      [19, 31, 19, 31],
      [
        [
          cell("Sex", { bold: true }),
          cell(held.gender),
          cell("Standing", { bold: true }),
          cell(held.status),
        ],
        [
          cell("Birthday / Age", { bold: true }),
          cell(`${held.birthday || "—"} / ${held.age}`),
          cell("Rank", { bold: true }),
          cell(held.title),
        ],
        [
          cell("Height", { bold: true }),
          cell(`${held.heightCm} cm`),
          cell("Social Standing", { bold: true }),
          cell(String(currentAttrValue(held, "SO", attrMods))),
        ],
        [
          cell("Weight", { bold: true }),
          cell(`${held.weightKg} kg`),
          cell("Adventure Points", { bold: true }),
          cell(String(held.apTotal || 0)),
        ],
        [
          cell("Hair Color", { bold: true }),
          cell(held.hairColor || "—"),
          cell("Spent-AP", { bold: true }),
          cell(String(held.apSpent || 0)),
        ],
        [
          cell("Eye Color", { bold: true }),
          cell(held.eyeColor || "—"),
          cell("AP-Credit", { bold: true }),
          cell(String(apCredit)),
        ],
        [
          cell("Appearance", { bold: true }),
          cell(held.appearance || "—"),
          cell("Background", { bold: true }),
          cell(held.background || "—"),
        ],
      ]
    )
  );

  blocks.push({
    kind: "heading",
    text: "Attributes & Base Values",
    fontSize: 14,
    align: "center",
  });

  const attrRows: DocCell[][] = [
    [
      cell("", { fontSize: FS_COMPACT, bold: true }),
      cell("Start", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Mod", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Bought", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Current", { fontSize: FS_COMPACT, bold: true, align: "center" }),
    ],
  ];
  for (const a of held.attributes) {
    const mod = attributeModsSum(attrMods, a.code);
    attrRows.push([
      cell(ATTR_LABELS[a.code] || a.code, { fontSize: FS_BODY }),
      cell(String(a.base), { align: "center", fontSize: FS_BODY }),
      cell(String(mod), { align: "center", fontSize: FS_BODY }),
      cell(String(a.purchased), { align: "center", fontSize: FS_BODY }),
      cell(String(currentAttrValue(held, a.code, attrMods)), {
        bold: true,
        align: "center",
        fontSize: FS_BODY,
      }),
    ]);
  }
  attrRows.push([
    cell("Speed", { fontSize: FS_BODY }),
    cell("", { fontSize: FS_BODY }),
    cell("", { fontSize: FS_BODY }),
    cell("", { fontSize: FS_BODY }),
    cell(String(derivedValue(held, "GS")), {
      bold: true,
      align: "center",
      fontSize: FS_BODY,
    }),
  ]);

  const derRows: DocCell[][] = [
    [
      cell("", { fontSize: FS_COMPACT, bold: true }),
      cell("Mod", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Base", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Current", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Bought", { fontSize: FS_COMPACT, bold: true, align: "center" }),
      cell("Max Buy", { fontSize: FS_COMPACT, bold: true, align: "center" }),
    ],
  ];
  for (const d of held.derived.filter((x) => x.code !== "GS")) {
    const current = d.base + d.modification + d.purchased;
    derRows.push([
      cell(DERIVED_SHEET_LABELS[d.code] || d.code, { fontSize: FS_COMPACT }),
      cell(String(d.modification), { align: "center", fontSize: FS_BODY }),
      cell(String(d.base), { align: "center", fontSize: FS_BODY }),
      cell(String(current), { bold: true, align: "center", fontSize: FS_BODY }),
      cell(String(d.purchased), { align: "center", fontSize: FS_BODY }),
      cell(d.maxPurchased != null ? String(d.maxPurchased) : "—", {
        align: "center",
        fontSize: FS_BODY,
      }),
    ]);
  }

  blocks.push({
    kind: "columns",
    columns: [
      { width: 48, blocks: [table([36, 16, 16, 16, 16], attrRows)] },
      { width: 52, blocks: [table([28, 12, 12, 16, 14, 18], derRows)] },
    ],
  });

  blocks.push({
    kind: "heading",
    text: "Special Abilities",
    fontSize: 14,
    align: "center",
  });
  blocks.push(
    table(
      [100],
      [
        [
          cell(
            held.specialAbilities
              .map((s) => {
                const base = saName(s.id);
                const talent = s.talent ? saName(s.talent) : "";
                const variant = s.variant ? saName(s.variant) : "";
                return [
                  base,
                  talent ? `(${talent})` : "",
                  variant ? `— ${variant}` : "",
                ]
                  .filter(Boolean)
                  .join(" ");
              })
              .join(", ") || "—"
          ),
        ],
      ]
    )
  );

  blocks.push({
    kind: "heading",
    text: "Advantages & Disadvantages",
    fontSize: 14,
    align: "center",
  });
  blocks.push(
    table(
      [100],
      [
        [
          cell(
            held.advantagesDisadvantages.map((t) => trName(t.id)).join(", ") ||
              "—"
          ),
        ],
      ]
    )
  );

  blocks.push({ kind: "pageBreak" });

  // ——— Talents (single compact two-column page; no empty notes grid) ———
  blocks.push(attributeStrip(held, attrMods));
  blocks.push({
    kind: "heading",
    text: "Talents, Languages, Gifts & Spells",
    fontSize: 14,
    align: "center",
  });
  const leftTalent = groupBlocks(held, TALENT_LEFT, tName, sName, true);
  const rightTalent = groupBlocks(held, TALENT_RIGHT, tName, sName);
  if (leftTalent.length || rightTalent.length) {
    if (leftTalent.length && rightTalent.length) {
      blocks.push({
        kind: "columns",
        columns: [
          { width: 49, blocks: leftTalent },
          { width: 49, blocks: rightTalent },
        ],
      });
    } else {
      for (const b of leftTalent.length ? leftTalent : rightTalent) {
        blocks.push(b);
      }
    }
  }

  blocks.push({ kind: "pageBreak" });

  // ——— Combat page ———
  const bav = derivedValue(held, "baseAT");
  const bpv = derivedValue(held, "basePA");
  const brv = derivedValue(held, "baseBRV");
  const biv = derivedValue(held, "baseINI");
  const sumEc = totalArmorEc(held);

  blocks.push(
    table(
      [25, 25, 25, 25],
      [
        [
          cell(`Base Attack Value: ${bav}`, {
            bold: true,
            align: "center",
            fontSize: FS_BODY,
          }),
          cell(`Base Parry Value: ${bpv}`, {
            bold: true,
            align: "center",
            fontSize: FS_BODY,
          }),
          cell(`Base Ranged Value: ${brv}`, {
            bold: true,
            align: "center",
            fontSize: FS_BODY,
          }),
          cell(`Base Initiative Value: ${biv}`, {
            bold: true,
            align: "center",
            fontSize: FS_BODY,
          }),
        ],
      ]
    )
  );

  blocks.push({
    kind: "heading",
    text: "Weapons & Combat Values",
    fontSize: 12,
    align: "center",
  });

  const meleeHeader: DocCell[] = [
    cell("Weapons", { bold: true, fontSize: FS_COMPACT }),
    cell("Type/EEC", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("DC", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("HP", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("HP/ST", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("INI", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("WM", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("AV", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("PV", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("HP", { bold: true, align: "center", fontSize: FS_COMPACT }),
    cell("BP", { bold: true, align: "center", fontSize: FS_COMPACT }),
  ];
  const meleeRows: DocCell[][] = [meleeHeader];
  const meleeSlots = slotCount(held.meleeWeapons.length, 3);
  for (let i = 0; i < meleeSlots; i++) {
    const w = held.meleeWeapons[i];
    if (!w) {
      meleeRows.push(emptyCells(11));
      continue;
    }
    const mains = meleeMainTalents(w.id);
    meleeRows.push([
      cell(w.name || w.id, { fontSize: FS_BODY }),
      cell(formatTypeEec(w.talent), { align: "center", fontSize: FS_BODY }),
      cell(formatDcEnglish(w), { align: "center", fontSize: FS_BODY }),
      cell(formatHpDice(w.tp), { align: "center", fontSize: FS_BODY }),
      cell(formatHpSt(w), { align: "center", fontSize: FS_BODY }),
      cell(w.ini != null ? String(w.ini) : "", { align: "center", fontSize: FS_BODY }),
      cell(formatWm(w), { align: "center", fontSize: FS_BODY }),
      cell(String(meleeAttackValue(held, w, mains)), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(String(meleeParryValue(held, w, mains)), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(meleeAdjustedHp(held, w), { align: "center", fontSize: FS_BODY }),
      cell(w.bf != null ? String(w.bf) : "", { align: "center", fontSize: FS_BODY }),
    ]);
  }
  // Shared name-column share (~22%) keeps stacked combat tables visually aligned.
  const NAME = 22;
  blocks.push(
    table([NAME, 10, 6, 8, 8, 5, 7, 6, 6, 8, 8], meleeRows)
  );

  blocks.push({
    kind: "heading",
    text: "Ranged Weapons",
    fontSize: 12,
    align: "center",
  });
  const rangedRows: DocCell[][] = [
    [
      cell("Ranged Weapons", { bold: true, fontSize: FS_COMPACT }),
      cell("Type/EEC", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("Range Bands", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("HP/Range", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("AV", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("HP", { bold: true, align: "center", fontSize: FS_COMPACT }),
    ],
  ];
  const rangedSlots = slotCount(held.rangedWeapons.length, 2);
  for (let i = 0; i < rangedSlots; i++) {
    const w = held.rangedWeapons[i];
    if (!w) {
      rangedRows.push(emptyCells(6));
      continue;
    }
    rangedRows.push([
      cell(w.name || w.id, { fontSize: FS_BODY }),
      cell(formatTypeEec(w.talent), { align: "center", fontSize: FS_BODY }),
      cell((w.ranges ?? []).join("/"), { align: "center", fontSize: FS_BODY }),
      cell((w.tpPlus ?? []).join("/"), { align: "center", fontSize: FS_BODY }),
      cell(String(rangedAttackValue(held, w, rangedMainTalent(w.id))), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(formatHpDice(w.tp), { align: "center", fontSize: FS_BODY }),
    ]);
  }
  blocks.push(table([NAME, 12, 22, 18, 10, 16], rangedRows));

  const unarmedRows: DocCell[][] = [
    [
      cell("Unarmed Combat", { bold: true, fontSize: FS_COMPACT }),
      cell("Type/EEC", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("HP/ST", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("INI", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("AV", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("PV", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("HP", { bold: true, align: "center", fontSize: FS_COMPACT }),
    ],
    [
      cell("Brawling", { fontSize: FS_BODY }),
      cell(formatTypeEec("Talent.Raufen", { unarmed: true }), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell("10/3", { align: "center", fontSize: FS_BODY }),
      cell("+0", { align: "center", fontSize: FS_BODY }),
      cell(String(unarmedAttack(held, "Talent.Raufen")), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(String(unarmedParry(held, "Talent.Raufen")), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(unarmedHp(held), { align: "center", fontSize: FS_BODY }),
    ],
    [
      cell("Wrestling", { fontSize: FS_BODY }),
      cell(formatTypeEec("Talent.Ringen", { unarmed: true }), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell("10/3", { align: "center", fontSize: FS_BODY }),
      cell("+0", { align: "center", fontSize: FS_BODY }),
      cell(String(unarmedAttack(held, "Talent.Ringen")), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(String(unarmedParry(held, "Talent.Ringen")), {
        align: "center",
        fontSize: FS_BODY,
      }),
      cell(unarmedHp(held), { align: "center", fontSize: FS_BODY }),
    ],
  ];
  blocks.push(table([NAME, 14, 12, 10, 12, 12, 18], unarmedRows));

  blocks.push({
    kind: "heading",
    text: "Shield / Parrying Weapon",
    fontSize: 12,
    align: "center",
  });
  const shieldRows: DocCell[][] = [
    [
      cell("Name", { bold: true, fontSize: FS_COMPACT }),
      cell("Type", { bold: true, fontSize: FS_COMPACT }),
      cell("INI", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("WM", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("PV", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("BP", { bold: true, align: "center", fontSize: FS_COMPACT }),
    ],
  ];
  const shieldSlots = slotCount(held.shields.length, 2);
  for (let i = 0; i < shieldSlots; i++) {
    const s = held.shields[i];
    if (!s) {
      shieldRows.push(emptyCells(6));
      continue;
    }
    const pv = bpv + (s.wmPa ?? 0);
    shieldRows.push([
      cell(s.name || s.id, { fontSize: FS_BODY }),
      cell(shieldTypeLabel(s.type), { fontSize: FS_BODY }),
      cell(s.ini != null ? String(s.ini) : "", { align: "center", fontSize: FS_BODY }),
      cell(formatWm(s), { align: "center", fontSize: FS_BODY }),
      cell(String(pv), { align: "center", fontSize: FS_BODY }),
      cell(s.bf != null ? String(s.bf) : "", { align: "center", fontSize: FS_BODY }),
    ]);
  }
  blocks.push(table([NAME, 20, 12, 16, 15, 15], shieldRows));

  blocks.push({
    kind: "heading",
    text: "Armor",
    fontSize: 12,
    align: "center",
  });

  let sumAr = 0;
  const armorRows: DocCell[][] = [
    [
      cell("Armor", { bold: true, fontSize: FS_COMPACT }),
      cell("AR", { bold: true, align: "center", fontSize: FS_COMPACT }),
      cell("EC", { bold: true, align: "center", fontSize: FS_COMPACT }),
    ],
  ];
  const armorList = held.armors.length ? held.armors : [];
  if (armorList.length === 0) {
    armorRows.push(emptyCells(3));
  } else {
    for (const a of armorList) {
      sumAr += a.rs ?? 0;
      armorRows.push([
        cell(a.name || a.id || "", { fontSize: FS_BODY }),
        cell(String(a.rs ?? ""), { align: "center", fontSize: FS_BODY }),
        cell(String(a.be ?? ""), { align: "center", fontSize: FS_BODY }),
      ]);
    }
  }
  armorRows.push([
    cell("Total", { bold: true, fontSize: FS_BODY }),
    cell(String(sumAr), { bold: true, align: "center", fontSize: FS_BODY }),
    cell(String(sumEc), { bold: true, align: "center", fontSize: FS_BODY }),
  ]);
  // Full-width armor + formula rows (name share matches stacked combat tables).
  blocks.push(table([NAME + 48, 15, 15], armorRows));

  const evade = bpv - sumEc;
  const initiative = biv - sumEc;
  // Compact formula rows — ASCII operators (jsPDF Times lacks U+2212).
  const formulaWidths = [12, 5, 10, 5, 48, 5, 15];
  blocks.push(
    table(formulaWidths, [
      [
        cell("BPV", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("-", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("EC", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("+", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("Special Ability", {
          bold: true,
          align: "center",
          fontSize: FS_COMPACT,
        }),
        cell("=", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("Evade", { bold: true, align: "center", fontSize: FS_COMPACT }),
      ],
      [
        cell(String(bpv), { align: "center", fontSize: FS_BODY }),
        cell("-", { align: "center", fontSize: FS_BODY }),
        cell(String(sumEc), { align: "center", fontSize: FS_BODY }),
        cell("+", { align: "center", fontSize: FS_BODY }),
        cell(""),
        cell("=", { align: "center", fontSize: FS_BODY }),
        cell(String(evade), {
          bold: true,
          align: "center",
          fontSize: FS_BODY,
        }),
      ],
    ])
  );
  blocks.push(
    table(formulaWidths, [
      [
        cell("BIV", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("-", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("EC", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("+", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("Special Ability", {
          bold: true,
          align: "center",
          fontSize: FS_COMPACT,
        }),
        cell("=", { bold: true, align: "center", fontSize: FS_COMPACT }),
        cell("Initiative", {
          bold: true,
          align: "center",
          fontSize: FS_COMPACT,
        }),
      ],
      [
        cell(String(biv), { align: "center", fontSize: FS_BODY }),
        cell("-", { align: "center", fontSize: FS_BODY }),
        cell(String(sumEc), { align: "center", fontSize: FS_BODY }),
        cell("+", { align: "center", fontSize: FS_BODY }),
        cell(""),
        cell("=", { align: "center", fontSize: FS_BODY }),
        cell(String(initiative), {
          bold: true,
          align: "center",
          fontSize: FS_BODY,
        }),
      ],
    ])
  );

  return { title: "TDE Character Sheet", blocks };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { triggerDownload };

/** Effective border mode for a table block. */
export function effectiveBorderStyle(block: DocTable): BorderStyle {
  if (block.borderStyle) return block.borderStyle;
  if (block.bordered === false) return "none";
  return "solid";
}
