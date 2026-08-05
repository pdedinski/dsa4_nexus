import type { SheetDocument } from "@/lib/chargen/export/sheetDocument";

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

/** Hand-rolled RTF approximating HeldExportRtf (Times, tables). */
export function toRtf(doc: SheetDocument): string {
  const parts: string[] = [];
  parts.push(
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs20"
  );

  for (const block of doc.blocks) {
    if (block.kind === "pageBreak") {
      parts.push("\\page ");
      continue;
    }
    if (block.kind === "heading") {
      const fs = Math.round(block.fontSize * 2);
      const align =
        block.align === "center"
          ? "\\qc "
          : block.align === "right"
            ? "\\qr "
            : "\\ql ";
      parts.push(
        `\\pard${align}\\b\\fs${fs} ${rtfUnicode(block.text)}\\b0\\fs20\\par\\pard\\ql `
      );
      continue;
    }
    if (block.kind === "table") {
      const total = block.widths.reduce((a, b) => a + b, 0) || 100;
      const twips = 9000;
      for (const row of block.rows) {
        parts.push("\\trowd\\trgaph108\\trleft0");
        let x = 0;
        let col = 0;
        for (let i = 0; i < row.length; i++) {
          const cell = row[i];
          const span = cell.colspan ?? 1;
          let w = 0;
          for (let s = 0; s < span; s++) {
            w += block.widths[col + s] ?? 10;
          }
          col += span;
          x += Math.round((w / total) * twips);
          if (block.bordered) {
            parts.push(
              "\\clbrdrt\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10"
            );
          }
          parts.push(`\\cellx${x}`);
        }
        col = 0;
        for (const cell of row) {
          const fs = Math.round((cell.fontSize ?? 12) * 2);
          const b = cell.bold ? "\\b " : "";
          const b0 = cell.bold ? "\\b0 " : "";
          const al =
            cell.align === "center"
              ? "\\qc "
              : cell.align === "right"
                ? "\\qr "
                : "\\ql ";
          parts.push(
            `\\pard\\intbl${al}${b}\\fs${fs} ${rtfUnicode(cell.text)}${b0}\\cell`
          );
          col += cell.colspan ?? 1;
        }
        parts.push("\\row ");
      }
      parts.push("\\pard\\par ");
    }
  }

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
