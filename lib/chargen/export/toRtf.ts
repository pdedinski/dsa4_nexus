import type {
  DocBlock,
  DocCell,
  DocColumns,
  DocTable,
  SheetDocument,
} from "@/lib/chargen/export/sheetDocument";
import { effectiveBorderStyle } from "@/lib/chargen/export/sheetDocument";

/** A4 content width in twips (11906 paper − 2×720 margins). */
const PAGE_TWIPS = 10466;

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\line ");
}

function rtfUnicode(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 128) out += esc(ch);
    else out += `\\u${code}?`;
  }
  return out;
}

function cellBorderRtf(style: ReturnType<typeof effectiveBorderStyle>): string {
  if (style === "none") return "";
  return (
    "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10" +
    "\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10"
  );
}

function cellAlign(c: DocCell): string {
  if (c.align === "center") return "\\qc ";
  if (c.align === "right") return "\\qr ";
  return "\\ql ";
}

function cellText(c: DocCell): string {
  const fs = Math.round((c.fontSize ?? 10) * 2);
  const b = c.bold ? "\\b " : "";
  const b0 = c.bold ? "\\b0 " : "";
  return `${cellAlign(c)}${b}\\fs${fs} ${rtfUnicode(c.text)}${b0}`;
}

function emptyCell(): DocCell {
  return { text: "" };
}

function emptySide(sideCols: number): DocCell[] {
  return Array.from({ length: sideCols }, () => emptyCell());
}

/** Pad / expand a row so its colspan sum equals sideCols (Java-style pane). */
function normalizeToSide(row: DocCell[], sideCols: number): DocCell[] {
  const spanSum = row.reduce((a, c) => a + (c.colspan ?? 1), 0);
  if (row.length === 1) {
    return [{ ...row[0], colspan: sideCols }];
  }
  const out = row.map((c) => ({ ...c }));
  let sum = spanSum;
  while (sum < sideCols) {
    out.push(emptyCell());
    sum += 1;
  }
  return out;
}

function maxNativeCols(blocks: DocBlock[]): number {
  let max = 1;
  for (const b of blocks) {
    if (b.kind === "table") {
      max = Math.max(max, b.widths.length);
    }
  }
  return max;
}

/** Flatten a column stack of tables into sequential side-pane rows. */
function blocksToSideRows(blocks: DocBlock[], sideCols: number): DocCell[][] {
  const rows: DocCell[][] = [];
  for (const b of blocks) {
    if (b.kind === "heading") {
      rows.push([
        {
          text: b.text,
          bold: true,
          align: "center",
          colspan: sideCols,
          fontSize: b.fontSize,
        },
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
  if (sideCols <= 0) return [halfPct];
  // Name column gets the bulk; trailing value columns share the rest.
  if (sideCols === 1) return [halfPct];
  const trail = sideCols - 1;
  const trailEach = Math.max(1, Math.floor((halfPct * 0.35) / trail));
  const trailTotal = trailEach * trail;
  const name = halfPct - trailTotal;
  return [name, ...Array.from({ length: trail }, () => trailEach)];
}

/**
 * Word does not reliably render nested RTF tables. Mirror the Java chargen:
 * one flat wide table with left pane | gutter | right pane.
 */
function renderColumnsZipped(block: DocColumns, parts: string[]) {
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
  if (n === 0) return;

  const leftW = sideWidthShares(sideCols, 49);
  const rightW = sideWidthShares(sideCols, 49);
  const widths = [...leftW, 2, ...rightW];
  const rows: DocCell[][] = [];
  for (let i = 0; i < n; i++) {
    const L = leftRows[i] ?? emptySide(sideCols);
    const R = rightRows[i] ?? emptySide(sideCols);
    rows.push([...L, emptyCell(), ...R]);
  }

  renderTable(
    {
      kind: "table",
      widths,
      rows,
      bordered: true,
      borderStyle: "solid",
    },
    parts
  );
}

function renderTable(block: DocTable, parts: string[]) {
  const style = effectiveBorderStyle(block);
  const border = cellBorderRtf(style);
  const total = block.widths.reduce((a, b) => a + b, 0) || 100;
  const widthTwips = PAGE_TWIPS;

  for (const row of block.rows) {
    const cellxParts: string[] = [];
    let x = 0;
    let col = 0;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      const span = c.colspan ?? 1;
      let w = 0;
      for (let s = 0; s < span; s++) {
        w += block.widths[col + s] ?? 10;
      }
      col += span;
      x += Math.round((w / total) * widthTwips);
      if (border) cellxParts.push(border);
      cellxParts.push(`\\cellx${x}`);
    }
    const cellx = cellxParts.join("");

    parts.push(`\\trowd\\trgaph40\\trleft0${cellx}`);
    for (const c of row) {
      parts.push(`\\pard\\intbl${cellText(c)}\\cell `);
    }
    parts.push("\\row ");
  }
  parts.push("\\pard\\sa40\\par ");
}

function renderHeading(
  text: string,
  fontSize: number,
  align: string | undefined,
  parts: string[]
) {
  const fs = Math.round(fontSize * 2);
  const al =
    align === "center" ? "\\qc " : align === "right" ? "\\qr " : "\\ql ";
  parts.push(
    `\\pard\\sa40\\sb80${al}\\b\\fs${fs} ${rtfUnicode(text)}\\b0\\fs20\\par\\pard\\ql `
  );
}

/**
 * Word needs \\page followed by a (tiny) \\par after tables; bare \\page is
 * often ignored. \\fs0 keeps the forced paragraph from adding visible space.
 */
function renderPageBreak(parts: string[]) {
  parts.push("\\pard\\plain\\page\\fs0\\par\\fs20\\pard ");
}

function renderColumns(block: DocColumns, parts: string[]) {
  if (block.columns.length === 1) {
    renderBlocks(block.columns[0].blocks, parts);
    return;
  }
  if (block.columns.length === 2) {
    renderColumnsZipped(block, parts);
    return;
  }
  for (const col of block.columns) {
    renderBlocks(col.blocks, parts);
  }
}

function renderBlocks(blocks: DocBlock[], parts: string[]) {
  for (const block of blocks) {
    if (block.kind === "pageBreak") {
      renderPageBreak(parts);
      continue;
    }
    if (block.kind === "heading") {
      renderHeading(block.text, block.fontSize, block.align, parts);
      continue;
    }
    if (block.kind === "table") {
      renderTable(block, parts);
      continue;
    }
    if (block.kind === "columns") {
      renderColumns(block, parts);
    }
  }
}

/** Hand-rolled RTF approximating the Word-like / Java chargen bordered sheet. */
export function toRtf(doc: SheetDocument): string {
  const parts: string[] = [];
  parts.push(
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}" +
      "\\paperw11906\\paperh16838" +
      "\\margl720\\margr720\\margt720\\margb720" +
      "\\f0\\fs20"
  );
  renderBlocks(doc.blocks, parts);
  parts.push("}");
  return parts.join("");
}

export function downloadRtf(doc: SheetDocument, filename: string) {
  const blob = new Blob([toRtf(doc)], { type: "application/rtf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
