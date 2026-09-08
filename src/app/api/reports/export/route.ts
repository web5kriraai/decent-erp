import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  getDelayAnalysisReport,
  getDesignerRankingReport,
  getMaterialAnalysisReport,
} from "@/lib/services/report-datasets-service";
import { prisma } from "@/lib/db";

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function csvResponse(csv: string, filename: string, correlationId: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Correlation-Id": correlationId,
    },
  });
}

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const type = new URL(request.url).searchParams.get("type") ?? "design-performance";

    if (type === "delay-analysis") {
      const report = await getDelayAnalysisReport();
      const csv = toCsv(
        ["IdeaRef", "Collection", "Stage", "Assignee", "DueAt", "Status", "OverdueDays"],
        report.tasks.map((t) => [
          t.ideaRef,
          t.collectionName,
          t.stage,
          t.assignee,
          t.dueAt,
          t.status,
          t.overdueDays,
        ]),
      );
      return csvResponse(csv, "delay-analysis.csv", ctx.correlationId);
    }

    if (type === "material-analysis") {
      const report = await getMaterialAnalysisReport();
      const csv = toCsv(
        ["IdeaRef", "ItemType", "Item", "Qty", "Unit", "Source", "Status"],
        report.lines.map((l) => [
          l.ideaRef,
          l.itemType,
          l.itemName,
          String(l.quantity),
          l.unit,
          l.source,
          l.status,
        ]),
      );
      return csvResponse(csv, "material-analysis.csv", ctx.correlationId);
    }

    if (type === "cost-analysis") {
      const costs = await prisma.designCost.findMany({
        include: { design: { select: { ideaRef: true, collectionName: true } } },
        take: 500,
        orderBy: { id: "desc" },
      });
      const csv = toCsv(
        ["IdeaRef", "Collection", "CostType", "Category", "Amount"],
        costs.map((c) => [
          c.design.ideaRef,
          c.design.collectionName,
          c.costType,
          c.costCategory ?? "",
          String(c.amount),
        ]),
      );
      return csvResponse(csv, "cost-analysis.csv", ctx.correlationId);
    }

    if (type === "designer-ranking") {
      const report = await getDesignerRankingReport();
      const csv = toCsv(
        ["Rank", "Employee", "Code", "WeightedScore"],
        report.rankings.map((r) => [r.rank, r.name, r.code, r.weightedScore.toFixed(2)]),
      );
      return csvResponse(csv, "designer-ranking.csv", ctx.correlationId);
    }

    const designs = await prisma.designConcept.findMany({
      include: {
        productType: { select: { name: true } },
        season: { select: { name: true } },
        successMetrics: true,
      },
      take: 500,
      orderBy: { updatedAtUtc: "desc" },
    });
    const csv = toCsv(
      ["IdeaRef", "Collection", "Product", "Season", "Status", "Stage"],
      designs.map((d) => [
        d.ideaRef,
        d.collectionName,
        d.productType.name,
        d.season.name,
        d.status,
        d.currentStage ?? "",
      ]),
    );
    return csvResponse(csv, "design-performance.csv", ctx.correlationId);
  });
}
