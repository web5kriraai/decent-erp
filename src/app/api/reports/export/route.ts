import { NextResponse } from "next/server";
import { withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildReportExportTable,
  isReportExportType,
  toCsv,
} from "@/lib/services/report-export-service";
import { buildReportPdfBuffer } from "@/lib/services/report-pdf";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const typeParam = params.get("type") ?? "design-performance";
    const format = (params.get("format") ?? "csv").toLowerCase();

    if (!isReportExportType(typeParam)) {
      throw new ApiError("Unknown export type", 400);
    }
    if (format !== "csv" && format !== "pdf") {
      throw new ApiError("format must be csv or pdf", 400);
    }

    const table = await buildReportExportTable(typeParam, {
      companyId: ctx.companyId,
      locationId: ctx.locationId,
    });

    if (format === "pdf") {
      const buffer = await buildReportPdfBuffer(table);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${typeParam}.pdf"`,
          "X-Correlation-Id": ctx.correlationId,
        },
      });
    }

    const csv = toCsv(table.headers, table.rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${typeParam}.csv"`,
        "X-Correlation-Id": ctx.correlationId,
      },
    });
  });
}
