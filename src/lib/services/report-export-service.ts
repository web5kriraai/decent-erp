import { prisma } from "@/lib/db";
import type { TenantScope } from "@/lib/tenant";
import { designTenantWhere } from "@/lib/tenant";

export const REPORT_EXPORT_TYPES = [
  "design-performance",
  "cost-analysis",
  "material-analysis",
  "delay-analysis",
  "designer-ranking",
] as const;

export type ReportExportType = (typeof REPORT_EXPORT_TYPES)[number];

export type ReportExportTable = {
  type: ReportExportType;
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
};

const TITLES: Record<ReportExportType, string> = {
  "design-performance": "Design Performance",
  "cost-analysis": "Cost Analysis",
  "material-analysis": "Material Analysis",
  "delay-analysis": "Delay Analysis",
  "designer-ranking": "Designer Ranking",
};

export function isReportExportType(value: string): value is ReportExportType {
  return (REPORT_EXPORT_TYPES as readonly string[]).includes(value);
}

export async function buildReportExportTable(
  type: ReportExportType,
  scope: TenantScope,
): Promise<ReportExportTable> {
  const designScope = designTenantWhere(scope);

  if (type === "delay-analysis") {
    const delayed = await prisma.designTask.findMany({
      where: {
        dueAt: { lt: new Date() },
        status: { in: ["PENDING", "ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"] },
        design: designScope,
      },
      include: {
        design: { select: { ideaRef: true, collectionName: true } },
        assignedEmployee: { select: { name: true } },
        subProcess: { select: { name: true } },
      },
      take: 500,
    });
    return {
      type,
      title: TITLES[type],
      headers: ["IdeaRef", "Collection", "Stage", "Assignee", "DueAt", "Status"],
      rows: delayed.map((t) => [
        t.design.ideaRef,
        t.design.collectionName,
        t.subProcess.name,
        t.assignedEmployee?.name,
        t.dueAt?.toISOString() ?? "",
        t.status,
      ]),
    };
  }

  if (type === "material-analysis") {
    const lines = await prisma.designMaterialLine.findMany({
      where: { design: designScope },
      include: {
        design: { select: { ideaRef: true } },
        catalogItem: { select: { code: true, name: true, masterType: true } },
      },
      take: 500,
    });
    return {
      type,
      title: TITLES[type],
      headers: ["IdeaRef", "ItemType", "Item", "Qty", "Unit", "Source", "Status"],
      rows: lines.map((l) => [
        l.design.ideaRef,
        l.catalogItem.masterType,
        l.catalogItem.name,
        String(l.quantity),
        l.unit,
        l.source,
        l.status,
      ]),
    };
  }

  if (type === "cost-analysis") {
    const costs = await prisma.designCost.findMany({
      where: { design: designScope },
      include: { design: { select: { ideaRef: true, collectionName: true } } },
      take: 500,
      orderBy: { id: "desc" },
    });
    return {
      type,
      title: TITLES[type],
      headers: ["IdeaRef", "Collection", "CostType", "Category", "Amount"],
      rows: costs.map((c) => [
        c.design.ideaRef,
        c.design.collectionName,
        c.costType,
        c.costCategory ?? "",
        String(c.amount),
      ]),
    };
  }

  if (type === "designer-ranking") {
    const scores = await prisma.employeeKpiScore.findMany({
      where: {
        periodYear: new Date().getUTCFullYear(),
        periodMonth: new Date().getUTCMonth() + 1,
        employee: { companyId: scope.companyId },
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
    return {
      type,
      title: TITLES[type],
      headers: ["Rank", "Employee", "Code", "WeightedScore"],
      rows: ranked.map((r, i) => [i + 1, r.name, r.code, r.total.toFixed(2)]),
    };
  }

  const designs = await prisma.designConcept.findMany({
    where: designScope,
    include: {
      productType: { select: { name: true } },
      season: { select: { name: true } },
    },
    take: 500,
    orderBy: { updatedAtUtc: "desc" },
  });
  return {
    type: "design-performance",
    title: TITLES["design-performance"],
    headers: ["IdeaRef", "Collection", "Product", "Season", "Status", "Stage"],
    rows: designs.map((d) => [
      d.ideaRef,
      d.collectionName,
      d.productType.name,
      d.season.name,
      d.status,
      d.currentStage ?? "",
    ]),
  };
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}
