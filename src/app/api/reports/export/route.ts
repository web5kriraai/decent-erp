import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";

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
      const delayed = await prisma.designTask.findMany({
        where: {
          dueAt: { lt: new Date() },
          status: { in: ["PENDING", "ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"] },
        },
        include: {
          design: { select: { ideaRef: true, collectionName: true } },
          assignedEmployee: { select: { name: true } },
          subProcess: { select: { name: true } },
        },
        take: 500,
      });
      const csv = toCsv(
        ["IdeaRef", "Collection", "Stage", "Assignee", "DueAt", "Status"],
        delayed.map((t) => [
          t.design.ideaRef,
          t.design.collectionName,
          t.subProcess.name,
          t.assignedEmployee?.name,
          t.dueAt?.toISOString() ?? "",
          t.status,
        ]),
      );
      return csvResponse(csv, "export.csv", ctx.correlationId);
    }

    if (type === "material-analysis") {
      const lines = await prisma.designMaterialLine.findMany({
        include: {
          design: { select: { ideaRef: true } },
          catalogItem: { select: { code: true, name: true, masterType: true } },
        },
        take: 500,
      });
      const csv = toCsv(
        ["IdeaRef", "ItemType", "Item", "Qty", "Unit", "Source", "Status"],
        lines.map((l) => [
          l.design.ideaRef,
          l.catalogItem.masterType,
          l.catalogItem.name,
          String(l.quantity),
          l.unit,
          l.source,
          l.status,
        ]),
      );
      return csvResponse(csv, "export.csv", ctx.correlationId);
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
      return csvResponse(csv, "export.csv", ctx.correlationId);
    }

    if (type === "designer-ranking") {
      const scores = await prisma.employeeKpiScore.findMany({
        where: {
          periodYear: new Date().getUTCFullYear(),
          periodMonth: new Date().getUTCMonth() + 1,
        },
        include: { employee: { select: { name: true, employeeCode: true } } },
        take: 500,
      });
      const byEmp = new Map<string, { name: string; code: string; total: number }>();
      for (const s of scores) {
        const key = String(s.employeeId);
        const cur = byEmp.get(key) ?? {
          name: s.employee.name,
          code: s.employee.employeeCode,
          total: 0,
        };
        cur.total += Number(s.weightedScore);
        byEmp.set(key, cur);
      }
      const ranked = [...byEmp.values()].sort((a, b) => b.total - a.total);
      const csv = toCsv(
        ["Rank", "Employee", "Code", "WeightedScore"],
        ranked.map((r, i) => [i + 1, r.name, r.code, r.total.toFixed(2)]),
      );
      return csvResponse(csv, "export.csv", ctx.correlationId);
    }

    // design-performance default
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
    return csvResponse(csv, "export.csv", ctx.correlationId);
  });
}
