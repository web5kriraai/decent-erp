import { prisma } from "@/lib/db";

/** Shared datasets for interactive report pages + CSV export. */

export async function getMaterialAnalysisReport() {
  const lines = await prisma.designMaterialLine.findMany({
    include: {
      design: { select: { id: true, ideaRef: true, collectionName: true } },
      catalogItem: { select: { code: true, name: true, masterType: true } },
    },
    take: 500,
    orderBy: { id: "desc" },
  });

  const byStatus: Record<string, number> = {};
  const byMasterType: Record<string, number> = {};
  for (const line of lines) {
    byStatus[line.status] = (byStatus[line.status] ?? 0) + 1;
    byMasterType[line.catalogItem.masterType] =
      (byMasterType[line.catalogItem.masterType] ?? 0) + 1;
  }

  return {
    total: lines.length,
    byStatus,
    byMasterType,
    lines: lines.map((l) => ({
      id: l.id.toString(),
      ideaRef: l.design.ideaRef,
      collectionName: l.design.collectionName,
      designId: l.design.id.toString(),
      itemType: l.catalogItem.masterType,
      itemCode: l.catalogItem.code,
      itemName: l.catalogItem.name,
      quantity: Number(l.quantity),
      unit: l.unit,
      source: l.source,
      status: l.status,
    })),
  };
}

export async function getDelayAnalysisReport() {
  const now = new Date();
  const delayed = await prisma.designTask.findMany({
    where: {
      dueAt: { lt: now },
      status: { in: ["PENDING", "ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"] },
    },
    include: {
      design: { select: { id: true, ideaRef: true, collectionName: true } },
      assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
      subProcess: { select: { name: true, code: true } },
    },
    take: 500,
    orderBy: { dueAt: "asc" },
  });

  const byStage: Record<string, number> = {};
  for (const task of delayed) {
    const key = task.subProcess.code;
    byStage[key] = (byStage[key] ?? 0) + 1;
  }

  return {
    total: delayed.length,
    byStage,
    tasks: delayed.map((t) => {
      const dueAt = t.dueAt!;
      const overdueDays = Math.max(
        0,
        Math.floor((now.getTime() - dueAt.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return {
        id: t.id.toString(),
        designId: t.design.id.toString(),
        ideaRef: t.design.ideaRef,
        collectionName: t.design.collectionName,
        stage: t.subProcess.name,
        stageCode: t.subProcess.code,
        assignee: t.assignedEmployee?.name ?? null,
        assigneeCode: t.assignedEmployee?.employeeCode ?? null,
        dueAt: dueAt.toISOString(),
        status: t.status,
        overdueDays,
      };
    }),
  };
}

export async function getDesignerRankingReport(year?: number, month?: number) {
  const now = new Date();
  const periodYear = year ?? now.getUTCFullYear();
  const periodMonth = month ?? now.getUTCMonth() + 1;

  const scores = await prisma.employeeKpiScore.findMany({
    where: { periodYear, periodMonth },
    include: { employee: { select: { id: true, name: true, employeeCode: true } } },
    take: 2000,
  });

  const byEmp = new Map<
    number,
    { employeeId: number; name: string; code: string; total: number; metricCount: number }
  >();
  for (const s of scores) {
    const cur = byEmp.get(s.employeeId) ?? {
      employeeId: s.employeeId,
      name: s.employee.name,
      code: s.employee.employeeCode,
      total: 0,
      metricCount: 0,
    };
    cur.total += Number(s.weightedScore);
    cur.metricCount += 1;
    byEmp.set(s.employeeId, cur);
  }

  const ranked = [...byEmp.values()]
    .sort((a, b) => b.total - a.total)
    .map((r, index) => ({
      rank: index + 1,
      employeeId: r.employeeId,
      name: r.name,
      code: r.code,
      weightedScore: Math.round(r.total * 100) / 100,
      metricCount: r.metricCount,
    }));

  return {
    periodYear,
    periodMonth,
    total: ranked.length,
    rankings: ranked,
  };
}
