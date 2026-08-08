import type {
  DocBlock,
  DocCell,
  DocTable,
  SheetDocument,
} from "@/lib/chargen/export/sheetDocument";
import {
  effectiveBorderStyle,
  zipDocColumns,
} from "@/lib/chargen/export/sheetDocument";

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
      const zipped = zipDocColumns(block);
      if (zipped) {
        renderTable(zipped, parts);
      } else {
        for (const col of block.columns) {
          renderBlocks(col.blocks, parts);
        }
      }
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
