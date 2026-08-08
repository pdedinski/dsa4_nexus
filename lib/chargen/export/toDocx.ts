import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  PageBreak,
  BorderStyle,
} from "docx";
import type {
  DocBlock,
  DocTable,
  SheetDocument,
} from "@/lib/chargen/export/sheetDocument";
import { effectiveBorderStyle, zipDocColumns } from "@/lib/chargen/export/sheetDocument";

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

function bordersFor(block: DocTable) {
  const style = effectiveBorderStyle(block);
  if (style === "none") return noBorder;
  return thinBorder;
}

function buildTableWithWidths(block: DocTable, widthPct = 100): Table {
  const total = block.widths.reduce((a, b) => a + b, 0) || 100;
  const borders = bordersFor(block);
  return new Table({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    rows: block.rows.map((row) => {
      let col = 0;
      return new TableRow({
        children: row.map((c) => {
          const span = c.colspan ?? 1;
          let w = 0;
          for (let s = 0; s < span; s++) {
            w += block.widths[col + s] ?? 10;
          }
          col += span;
          return new TableCell({
            borders,
            width: {
              size: Math.round((w / total) * 100),
              type: WidthType.PERCENTAGE,
            },
            columnSpan: span > 1 ? span : undefined,
            children: [
              new Paragraph({
                alignment:
                  c.align === "center"
                    ? AlignmentType.CENTER
                    : c.align === "right"
                      ? AlignmentType.RIGHT
                      : AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: c.text,
                    bold: c.bold,
                    font: "Times New Roman",
                    size: (c.fontSize ?? 12) * 2,
                  }),
                ],
              }),
            ],
          });
        }),
      });
    }),
  });
}

function blocksToElements(blocks: DocBlock[]): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];
  for (const block of blocks) {
    if (block.kind === "pageBreak") {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
      continue;
    }
    if (block.kind === "heading") {
      children.push(
        new Paragraph({
          alignment:
            block.align === "center"
              ? AlignmentType.CENTER
              : AlignmentType.LEFT,
          spacing: { after: 80, before: 60 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              font: "Times New Roman",
              size: block.fontSize * 2,
            }),
          ],
          heading:
            block.fontSize >= 20
              ? HeadingLevel.TITLE
              : HeadingLevel.HEADING_1,
        })
      );
      continue;
    }
    if (block.kind === "table") {
      children.push(buildTableWithWidths(block));
      children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      continue;
    }
    if (block.kind === "columns") {
      const zipped = zipDocColumns(block);
      if (zipped) {
        children.push(buildTableWithWidths(zipped));
        children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
      } else {
        for (const col of block.columns) {
          for (const b of col.blocks) {
            if (b.kind === "heading") {
              children.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: b.text,
                      bold: true,
                      font: "Times New Roman",
                      size: b.fontSize * 2,
                    }),
                  ],
                })
              );
            } else if (b.kind === "table") {
              children.push(buildTableWithWidths(b));
              children.push(
                new Paragraph({ children: [], spacing: { after: 80 } })
              );
            }
          }
        }
      }
    }
  }
  return children;
}

export async function toDocxBlob(doc: SheetDocument): Promise<Blob> {
  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 560,
              right: 560,
              bottom: 560,
              left: 560,
            },
          },
        },
        children: blocksToElements(doc.blocks),
      },
    ],
  });
  return Packer.toBlob(document);
}

export async function downloadDocx(doc: SheetDocument, filename: string) {
  const blob = await toDocxBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
