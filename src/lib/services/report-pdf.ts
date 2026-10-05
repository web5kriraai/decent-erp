import PDFDocument from "pdfkit";
import type { ReportExportTable } from "@/lib/services/report-export-service";

function cellText(value: string | number | null | undefined) {
  if (value == null) return "";
  const s = String(value);
  return s.length > 48 ? `${s.slice(0, 45)}...` : s;
}

/** Build a simple tabular PDF buffer for report exports. */
export async function buildReportPdfBuffer(table: ReportExportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      info: {
        Title: `Decent ERP - ${table.title}`,
        Author: "Decent ERP",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(`Decent ERP — ${table.title}`, { continued: false });
    doc
      .fontSize(9)
      .fillColor("#555555")
      .text(`Generated ${new Date().toISOString()} · ${table.rows.length} row(s)`, {
        continued: false,
      });
    doc.moveDown(1);
    doc.fillColor("#000000");

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colCount = Math.max(table.headers.length, 1);
    const colWidth = pageWidth / colCount;
    const startX = doc.page.margins.left;
    let y = doc.y;

    const drawRow = (cells: string[], bold: boolean) => {
      const rowHeight = 18;
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      cells.forEach((cell, i) => {
        doc.text(cell, startX + i * colWidth, y, {
          width: colWidth - 4,
          lineBreak: false,
          ellipsis: true,
        });
      });
      y += rowHeight;
      doc
        .moveTo(startX, y - 2)
        .lineTo(startX + pageWidth, y - 2)
        .strokeColor("#dddddd")
        .stroke();
    };

    drawRow(
      table.headers.map((h) => cellText(h)),
      true,
    );
    for (const row of table.rows) {
      drawRow(
        table.headers.map((_, i) => cellText(row[i])),
        false,
      );
    }

    if (table.rows.length === 0) {
      doc.font("Helvetica").fontSize(10).text("No rows for this export.", startX, y + 8);
    }

    doc.end();
  });
}
