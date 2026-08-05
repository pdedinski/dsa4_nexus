/**
 * Format-agnostic hero document model matching HeldExportRtf layout.
 */

import type { HeldModel } from "@/lib/chargen/types";
import {
  ATTR_LABELS,
  attrValue,
  derivedValue,
} from "@/lib/chargen/types";

export type Align = "left" | "center" | "right";

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
  bordered?: boolean;
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

export type DocBlock = DocHeading | DocTable | DocPageBreak;

export interface SheetDocument {
  title: string;
  blocks: DocBlock[];
}

function cell(
  text: string,
  opts: Partial<DocCell> = {}
): DocCell {
  return { text: text ?? "", ...opts };
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
  } = {}
): SheetDocument {
  const tName = names.talentName ?? ((id) => id);
  const sName = names.spellName ?? ((id) => id);
  const trName = names.traitName ?? ((id) => id);
  const saName = names.saName ?? ((id) => id);

  const blocks: DocBlock[] = [];

  blocks.push({
    kind: "heading",
    text: "Hero Document",
    fontSize: 22,
    align: "center",
  });

  // Personal data
  blocks.push({
    kind: "table",
    widths: [19, 81],
    rows: [
      [cell("Name", { bold: true }), cell(held.name)],
      [cell("Race", { bold: true }), cell(names.race || held.raceId)],
      [cell("Culture", { bold: true }), cell(names.culture || held.cultureId)],
      [
        cell("Profession", { bold: true }),
        cell(names.profession || held.professionId),
      ],
    ],
  });

  // Personal background — two columns conceptually flattened
  blocks.push({
    kind: "table",
    widths: [19, 30, 2, 19, 30],
    rows: [
      [
        cell("Gender", { bold: true }),
        cell(held.gender),
        cell(""),
        cell("Status", { bold: true }),
        cell(held.status),
      ],
      [
        cell("Birthday / Age", { bold: true }),
        cell(`${held.birthday || "—"} / ${held.age}`),
        cell(""),
        cell("Title", { bold: true }),
        cell(held.title),
      ],
      [
        cell("Height", { bold: true }),
        cell(`${held.heightCm} cm`),
        cell(""),
        cell("Social Standing", { bold: true }),
        cell(String(attrValue(held, "SO"))),
      ],
      [
        cell("Weight", { bold: true }),
        cell(`${held.weightKg} kg`),
        cell(""),
        cell("Total AP", { bold: true }),
        cell(String(held.apTotal)),
      ],
      [
        cell("Hair Color", { bold: true }),
        cell(held.hairColor),
        cell(""),
        cell("Spent AP", { bold: true }),
        cell(String(held.apSpent)),
      ],
      [
        cell("Eye Color", { bold: true }),
        cell(held.eyeColor),
        cell(""),
        cell("Available AP", { bold: true }),
        cell(String(held.apTotal - held.apSpent)),
      ],
      [
        cell("Appearance", { bold: true }),
        cell(held.appearance),
        cell(""),
        cell("Background", { bold: true }),
        cell(held.background),
      ],
    ],
  });

  blocks.push({
    kind: "heading",
    text: "Attributes & Base Values",
    fontSize: 16,
    align: "center",
  });

  const attrRows: DocCell[][] = [
    [
      cell("", { fontSize: 6, bold: true }),
      cell("Start", { fontSize: 6, bold: true, align: "center" }),
      cell("Purchased", { fontSize: 6, bold: true, align: "center" }),
      cell("Current", { fontSize: 6, bold: true, align: "center" }),
    ],
  ];
  for (const a of held.attributes) {
    attrRows.push([
      cell(ATTR_LABELS[a.code] || a.code),
      cell(String(a.base), { align: "center" }),
      cell(String(a.purchased), { align: "center" }),
      cell(String(a.base + a.purchased), { bold: true, align: "center" }),
    ]);
  }
  attrRows.push([
    cell("Speed"),
    cell(""),
    cell(""),
    cell(String(derivedValue(held, "GS")), { bold: true, align: "center" }),
  ]);
  blocks.push({ kind: "table", widths: [40, 20, 20, 20], rows: attrRows });

  const derRows: DocCell[][] = [
    [
      cell("", { fontSize: 6, bold: true }),
      cell("Mod", { fontSize: 6, bold: true, align: "center" }),
      cell("Base", { fontSize: 6, bold: true, align: "center" }),
      cell("Current", { fontSize: 6, bold: true, align: "center" }),
      cell("Purchased", { fontSize: 6, bold: true, align: "center" }),
    ],
  ];
  for (const d of held.derived.filter((x) => x.code !== "GS")) {
    derRows.push([
      cell(d.code),
      cell(String(d.modification), { align: "center" }),
      cell(String(d.base), { align: "center" }),
      cell(String(d.base + d.modification + d.purchased), {
        bold: true,
        align: "center",
      }),
      cell(String(d.purchased), { align: "center" }),
    ]);
  }
  blocks.push({ kind: "table", widths: [28, 18, 18, 18, 18], rows: derRows });

  blocks.push({
    kind: "heading",
    text: "Special Abilities",
    fontSize: 16,
    align: "center",
  });
  blocks.push({
    kind: "table",
    widths: [100],
    rows: [
      [
        cell(
          held.specialAbilities
            .map((s) => {
              const base = saName(s.id);
              const talent = s.talent ? saName(s.talent) : "";
              const variant = s.variant ? saName(s.variant) : "";
              return [base, talent ? `(${talent})` : "", variant ? `— ${variant}` : ""]
                .filter(Boolean)
                .join(" ");
            })
            .join(", ") || "—"
        ),
      ],
    ],
  });

  blocks.push({
    kind: "heading",
    text: "Advantages / Disadvantages",
    fontSize: 16,
    align: "center",
  });
  blocks.push({
    kind: "table",
    widths: [100],
    rows: [
      [
        cell(
          held.advantagesDisadvantages.map((t) => trName(t.id)).join(", ") ||
            "—"
        ),
      ],
    ],
  });

  blocks.push({ kind: "pageBreak" });

  // Compact attribute strip
  blocks.push({
    kind: "table",
    widths: Array(16).fill(6.25),
    bordered: true,
    rows: [
      held.attributes.flatMap((a) => [
        cell(`${a.code}:`, { bold: true, align: "right" }),
        cell(String(a.base + a.purchased)),
      ]),
    ],
  });

  blocks.push({
    kind: "heading",
    text: "Talents",
    fontSize: 16,
    align: "center",
  });

  const talentRows: DocCell[][] = [
    [
      cell("Talent", { bold: true }),
      cell("AT", { bold: true, align: "center" }),
      cell("PA", { bold: true, align: "center" }),
      cell("TP", { bold: true, align: "center" }),
    ],
  ];
  for (const t of held.talents) {
    const isLead = held.leadTalents.includes(t.id);
    const isCombat = t.id.startsWith("Talent.") && t.attack != null;
    const at = t.attack ?? (isCombat ? 0 : null);
    const pa =
      isCombat && at != null ? Math.max(0, t.tp - at) : null;
    const label = (isLead ? "* " : "") + tName(t.id);
    talentRows.push([
      cell(label),
      cell(at != null ? String(at) : "—", { align: "center" }),
      cell(pa != null ? String(pa) : "—", { align: "center" }),
      cell(String(t.tp), { align: "center" }),
    ]);
  }
  if (held.talents.length === 0) {
    talentRows.push([cell("—"), cell(""), cell(""), cell("")]);
  }
  blocks.push({ kind: "table", widths: [55, 15, 15, 15], rows: talentRows });

  if (held.spells.length) {
    const spellRows: DocCell[][] = [
      [
        cell("Spell", { bold: true }),
        cell("SP", { bold: true, align: "center" }),
      ],
    ];
    for (const s of held.spells) {
      const markers = [
        held.houseSpells.includes(s.id) ? "**" : "",
        held.leadSpells.includes(s.id) ? "*" : "",
      ]
        .filter(Boolean)
        .join(" ");
      spellRows.push([
        cell(`${markers ? `${markers} ` : ""}${sName(s.id)}`),
        cell(String(s.sp), { align: "center" }),
      ]);
    }
    blocks.push({
      kind: "heading",
      text: "Spells",
      fontSize: 16,
      align: "center",
    });
    blocks.push({ kind: "table", widths: [80, 20], rows: spellRows });
  }

  blocks.push({ kind: "pageBreak" });

  blocks.push({
    kind: "heading",
    text: "Weapon Combat Values",
    fontSize: 16,
    align: "center",
  });

  const meleeRows: DocCell[][] = [
    [
      cell("Melee Weapon", { bold: true }),
      cell("TP", { bold: true, align: "center" }),
      cell("INI", { bold: true, align: "center" }),
      cell("WM", { bold: true, align: "center" }),
      cell("BF", { bold: true, align: "center" }),
    ],
  ];
  for (let i = 0; i < 5; i++) {
    const w = held.meleeWeapons[i];
    meleeRows.push([
      cell(w?.name || w?.id || ""),
      cell(w?.tp || "", { align: "center" }),
      cell(w ? String(w.ini ?? "") : "", { align: "center" }),
      cell(
        w ? `${w.wmAt ?? 0}/${w.wmPa ?? 0}` : "",
        { align: "center" }
      ),
      cell(w ? String(w.bf ?? "") : "", { align: "center" }),
    ]);
  }
  blocks.push({ kind: "table", widths: [40, 15, 15, 15, 15], rows: meleeRows });

  const unarmedRows: DocCell[][] = [
    [
      cell("Brawling & Wrestling", { bold: true }),
      cell("Type/aEC", { bold: true }),
      cell("HP/ST", { bold: true, align: "center" }),
      cell("INI", { bold: true, align: "center" }),
      cell("AV", { bold: true, align: "center" }),
    ],
    [
      cell("Unarmed"),
      cell("—"),
      cell("10/3", { align: "center" }),
      cell("+0", { align: "center" }),
      cell("—", { align: "center" }),
    ],
  ];
  blocks.push({
    kind: "heading",
    text: "Unarmed Combat",
    fontSize: 14,
    align: "center",
  });
  blocks.push({ kind: "table", widths: [30, 20, 15, 15, 20], rows: unarmedRows });

  const rangedRows: DocCell[][] = [
    [
      cell("Ranged Weapon", { bold: true }),
      cell("TP", { bold: true, align: "center" }),
      cell("Ranges", { bold: true, align: "center" }),
    ],
  ];
  for (let i = 0; i < 3; i++) {
    const w = held.rangedWeapons[i];
    rangedRows.push([
      cell(w?.name || w?.id || ""),
      cell(w?.tp || "", { align: "center" }),
      cell(w?.ranges?.join(", ") || "", { align: "center" }),
    ]);
  }
  blocks.push({ kind: "table", widths: [40, 20, 40], rows: rangedRows });

  blocks.push({
    kind: "heading",
    text: "Shield / Parrying Weapon",
    fontSize: 16,
    align: "center",
  });
  const shieldRows: DocCell[][] = [
    [
      cell("Name", { bold: true }),
      cell("Type", { bold: true }),
      cell("INI", { bold: true, align: "center" }),
      cell("WM", { bold: true, align: "center" }),
      cell("BF", { bold: true, align: "center" }),
    ],
  ];
  for (let i = 0; i < 3; i++) {
    const s = held.shields[i];
    shieldRows.push([
      cell(s?.name || s?.id || ""),
      cell(s?.type || ""),
      cell(s ? String(s.ini ?? "") : "", { align: "center" }),
      cell(s ? `${s.wmAt ?? 0}/${s.wmPa ?? 0}` : "", { align: "center" }),
      cell(s ? String(s.bf ?? "") : "", { align: "center" }),
    ]);
  }
  blocks.push({ kind: "table", widths: [30, 20, 15, 20, 15], rows: shieldRows });

  blocks.push({
    kind: "heading",
    text: "Armor",
    fontSize: 16,
    align: "center",
  });
  const armorRows: DocCell[][] = [
    [
      cell("Piece", { bold: true }),
      cell("AR", { bold: true, align: "center" }),
      cell("EC", { bold: true, align: "center" }),
    ],
  ];
  let sumRs = 0;
  let sumBe = 0;
  for (let i = 0; i < 5; i++) {
    const a = held.armors[i];
    if (a) {
      sumRs += a.rs ?? 0;
      sumBe += a.be ?? 0;
    }
    armorRows.push([
      cell(a?.name || a?.id || ""),
      cell(a ? String(a.rs ?? "") : "", { align: "center" }),
      cell(a ? String(a.be ?? "") : "", { align: "center" }),
    ]);
  }
  armorRows.push([
    cell("Sum", { bold: true }),
    cell(String(sumRs), { bold: true, align: "center" }),
    cell(String(sumBe), { bold: true, align: "center" }),
  ]);
  blocks.push({ kind: "table", widths: [60, 20, 20], rows: armorRows });

  const pab = derivedValue(held, "basePA");
  const ini = derivedValue(held, "baseINI");
  blocks.push({
    kind: "table",
    widths: [100],
    rows: [
      [
        cell(
          `Dodge: PAB ${pab} − EC ${sumBe} = ${pab - sumBe}`
        ),
      ],
      [
        cell(
          `Initiative: INI ${ini} − EC ${sumBe} = ${ini - sumBe}`
        ),
      ],
    ],
  });

  return { title: "Hero Document", blocks };
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
