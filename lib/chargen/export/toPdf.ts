import { jsPDF } from "jspdf";
import autoTable, { type CellInput } from "jspdf-autotable";
import type {
  DocBlock,
  DocCell,
  DocTable,
  SheetDocument,
} from "@/lib/chargen/export/sheetDocument";
import { effectiveBorderStyle } from "@/lib/chargen/export/sheetDocument";

/** A4 height in pt — keep page chrome tight so content uses more of the page. */
const PAGE_HEIGHT = 842;
const MARGIN_X = 24;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 24;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;
/** Gap after each finished table before the next block. */
const AFTER_TABLE = 3;
/** Gap above a heading (from prior content to top of glyphs). */
const HEADING_GAP_ABOVE = 5;
/** Gap below a heading baseline before the next block. */
const HEADING_GAP_BELOW = 5;

type PdfCtx = {
  pdf: jsPDF;
  y: number;
  pageWidth: number;
  marginLeft: number;
  contentWidth: number;
};

function ensureSpace(ctx: PdfCtx, need: number) {
  if (ctx.y + need > CONTENT_BOTTOM) {
    ctx.pdf.addPage();
    ctx.y = MARGIN_TOP;
  }
}

function cellInput(c: DocCell): CellInput {
  return {
    content: c.text,
    colSpan: c.colspan && c.colspan > 1 ? c.colspan : undefined,
    styles: {
      font: "times",
      fontStyle: c.bold ? "bold" : "normal",
      fontSize: c.fontSize ?? 10,
      halign:
        c.align === "center"
          ? "center"
          : c.align === "right"
            ? "right"
            : "left",
      valign: "middle",
      cellPadding: { top: 1.25, right: 2, bottom: 1.25, left: 2 },
      overflow: "linebreak",
      minCellHeight: 10,
    },
  };
}

function expandRow(row: DocCell[]): CellInput[] {
  return row.map(cellInput);
}

function renderTable(ctx: PdfCtx, block: DocTable, tableWidth?: number) {
  ensureSpace(ctx, 24);
  const style = effectiveBorderStyle(block);
  const lineWidth = style === "none" ? 0 : 0.4;
  const width = tableWidth ?? ctx.contentWidth;
  const startY = ctx.y;
  const total = block.widths.reduce((a, b) => a + b, 0) || 100;

  autoTable(ctx.pdf, {
    startY,
    head: [],
    body: block.rows.map((row) => expandRow(row)),
    styles: {
      font: "times",
      fontSize: 10,
      cellPadding: { top: 1.25, right: 2, bottom: 1.25, left: 2 },
      lineWidth,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      overflow: "linebreak",
      valign: "middle",
      minCellHeight: 10,
    },
    theme: style === "none" ? "plain" : "grid",
    // Pin both margins so tableWidth is honored (avoids right-margin fight).
    margin: {
      left: ctx.marginLeft,
      right: ctx.pageWidth - ctx.marginLeft - width,
      bottom: MARGIN_BOTTOM,
    },
    tableWidth: width,
    columnStyles: Object.fromEntries(
      block.widths.map((w, i) => [
        i,
        { cellWidth: (width * w) / total },
      ])
    ),
  });
  // @ts-expect-error lastAutoTable injected by plugin
  ctx.y = (ctx.pdf.lastAutoTable?.finalY ?? startY) + AFTER_TABLE;
}

function renderHeading(
  ctx: PdfCtx,
  text: string,
  fontSize: number,
  center: boolean
) {
  // Text is drawn at baseline; leave room so glyphs clear the prior table
  // and the following table does not collide with descenders.
  ensureSpace(ctx, HEADING_GAP_ABOVE + fontSize + HEADING_GAP_BELOW + 4);
  ctx.y += HEADING_GAP_ABOVE;
  const baseline = ctx.y + fontSize * 0.78;
  ctx.pdf.setFont("times", "bold");
  ctx.pdf.setFontSize(fontSize);
  ctx.pdf.setTextColor(0, 0, 0);
  const textWidth = ctx.pdf.getTextWidth(text);
  const x = center
    ? ctx.marginLeft + (ctx.contentWidth - textWidth) / 2
    : ctx.marginLeft;
  ctx.pdf.text(text, x, baseline);
  ctx.y = baseline + HEADING_GAP_BELOW;
}

function renderBlocks(ctx: PdfCtx, blocks: DocBlock[]) {
  for (const block of blocks) {
    if (block.kind === "pageBreak") {
      ctx.pdf.addPage();
      ctx.y = MARGIN_TOP;
      continue;
    }
    if (block.kind === "heading") {
      renderHeading(
        ctx,
        block.text,
        block.fontSize,
        block.align === "center"
      );
      continue;
    }
    if (block.kind === "table") {
      renderTable(ctx, block);
      continue;
    }
    if (block.kind === "columns") {
      ensureSpace(ctx, 40);
      const startY = ctx.y;
      const gap = 8;
      const totalW = block.columns.reduce((a, c) => a + c.width, 0) || 100;
      let maxY = startY;
      let x = ctx.marginLeft;
      for (const col of block.columns) {
        const colWidth =
          ((ctx.contentWidth - gap * (block.columns.length - 1)) * col.width) /
          totalW;
        const colCtx: PdfCtx = {
          pdf: ctx.pdf,
          y: startY,
          pageWidth: ctx.pageWidth,
          marginLeft: x,
          contentWidth: colWidth,
        };
        for (const b of col.blocks) {
          if (b.kind === "heading") {
            renderHeading(colCtx, b.text, b.fontSize, b.align === "center");
          } else if (b.kind === "table") {
            renderTable(colCtx, b, colWidth);
          }
        }
        maxY = Math.max(maxY, colCtx.y);
        x += colWidth + gap;
      }
      ctx.y = maxY + 2;
    }
  }
}

export function toPdfBlob(doc: SheetDocument): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const ctx: PdfCtx = {
    pdf,
    y: MARGIN_TOP,
    pageWidth,
    marginLeft: MARGIN_X,
    contentWidth: pageWidth - MARGIN_X * 2,
  };
  renderBlocks(ctx, doc.blocks);
  return pdf.output("blob");
}

export function downloadPdf(doc: SheetDocument, filename: string) {
  const blob = toPdfBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
