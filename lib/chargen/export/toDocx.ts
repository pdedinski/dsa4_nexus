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
import type { SheetDocument } from "@/lib/chargen/export/sheetDocument";

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

export async function toDocxBlob(doc: SheetDocument): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];

  for (const block of doc.blocks) {
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
          spacing: { after: 200 },
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
      const total = block.widths.reduce((a, b) => a + b, 0) || 100;
      const borders = block.bordered ? thinBorder : noBorder;
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.rows.map(
            (row) =>
              new TableRow({
                children: row.map((c, i) => {
                  const w = block.widths[i] ?? 10;
                  return new TableCell({
                    borders,
                    width: {
                      size: Math.round((w / total) * 100),
                      type: WidthType.PERCENTAGE,
                    },
                    columnSpan: c.colspan,
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
              })
          ),
        })
      );
      children.push(new Paragraph({ children: [] }));
    }
  }

  const document = new Document({
    sections: [{ children }],
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
