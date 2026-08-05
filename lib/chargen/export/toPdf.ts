import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SheetDocument } from "@/lib/chargen/export/sheetDocument";

export function toPdfBlob(doc: SheetDocument): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  let y = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();

  for (const block of doc.blocks) {
    if (block.kind === "pageBreak") {
      pdf.addPage();
      y = 48;
      continue;
    }
    if (block.kind === "heading") {
      if (y > 720) {
        pdf.addPage();
        y = 48;
      }
      pdf.setFont("times", "bold");
      pdf.setFontSize(block.fontSize);
      const textWidth = pdf.getTextWidth(block.text);
      const x =
        block.align === "center" ? (pageWidth - textWidth) / 2 : 40;
      pdf.text(block.text, x, y);
      y += block.fontSize + 12;
      continue;
    }
    if (block.kind === "table") {
      if (y > 700) {
        pdf.addPage();
        y = 48;
      }
      autoTable(pdf, {
        startY: y,
        head: [],
        body: block.rows.map((row) => row.map((c) => c.text)),
        styles: {
          font: "times",
          fontSize: 10,
          cellPadding: 3,
        },
        theme: block.bordered ? "grid" : "plain",
        margin: { left: 40, right: 40 },
      });
      // @ts-expect-error lastAutoTable injected by plugin
      y = (pdf.lastAutoTable?.finalY ?? y) + 14;
    }
  }

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
