import { prisma } from "@/lib/db";
import {
  KPI_CALCULATION_VERSION,
  MISTAKE_CORRECTION_TYPES,
  SPEC_KPI_METRICS,
} from "@/lib/kpi-metrics";
import { computeTimeSummary } from "@/lib/services/time-calculation";

export async function getEmployeeKpiDashboard(employeeId?: number) {
  const where = employeeId ? { employeeId } : {};
  return prisma.employeeKpiScore.findMany({
    where,
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: {
      employee: { select: { id: true, name: true, employeeCode: true, role: { select: { code: true } } } },
    },
  });
}

export async function getDesignHeadKpi() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const [designsCreated, approved, released, live, teamScores] = await Promise.all([
    prisma.designConcept.count({
      where: {
        createdAtUtc: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lt: new Date(Date.UTC(year, month, 1)),
        },
      },
    }),
    prisma.designConcept.count({ where: { status: "APPROVED" } }),
    prisma.designConcept.count({ where: { status: "PRODUCTION_RELEASED" } }),
    prisma.designConcept.count({ where: { status: "LIVE" } }),
    getEmployeeKpiDashboard(),
  ]);

  const conversionRate = designsCreated
    ? Math.round((released / designsCreated) * 100)
    : 0;

  return {
    periodYear: year,
    periodMonth: month,
    ideasCreated: designsCreated,
    approvedCount: approved,
    releasedCount: released,
    liveCount: live,
    conversionPercent: conversionRate,
    teamScores: teamScores.filter((s) => s.employee.role.code === "DESIGN_HEAD"),
  };
}

export async function getKpiDefinitions(roleId?: number) {
  return prisma.employeeKpiDefinition.findMany({
    where: roleId ? { roleId } : {},
    orderBy: [{ roleId: "asc" }, { metricCode: "asc" }],
    include: { role: { select: { code: true, name: true } } },
  });
}

export async function calculateMonthlyKpi(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, roleId: true },
  });

  const results = [];

  for (const employee of employees) {
    const definitions = await prisma.employeeKpiDefinition.findMany({
      where: { roleId: employee.roleId, effectiveFrom: { lte: end } },
    });
    const metrics =
      definitions.length > 0
        ? definitions.map((d) => ({
            code: d.metricCode,
            weight: Number(d.weightPercent),
          }))
        : SPEC_KPI_METRICS.map((m) => ({ code: m.code, weight: m.weight }));

    const tasks = await prisma.designTask.findMany({
      where: {
        assignedEmployeeId: employee.id,
        updatedAtUtc: { gte: start, lt: end },
      },
      include: {
        timeEvents: { include: { holdReason: true } },
        corrections: true,
        subProcess: true,
        checklistResults: true,
      },
    });

    const completed = tasks.filter((t) => t.status === "COMPLETED");
    const onTime = completed.filter(
      (t) => t.completedAt && t.dueAt && t.completedAt <= t.dueAt,
    ).length;
    const mistakeCorrections = tasks.flatMap((t) =>
      t.corrections.filter((c) =>
        MISTAKE_CORRECTION_TYPES.includes(c.correctionType as (typeof MISTAKE_CORRECTION_TYPES)[number]),
      ),
    );
    const firstTimeRight = completed.filter(
      (t) => !t.corrections.some((c) => MISTAKE_CORRECTION_TYPES.includes(c.correctionType as never)),
    ).length;

    let totalActive = 0;
    let totalExpected = 0;
    let checklistPassed = 0;
    let checklistTotal = 0;
    let docsOk = 0;
    let docsRequired = 0;
    let depOk = 0;
    let depTotal = 0;

    for (const task of tasks) {
      const { activeSeconds } = computeTimeSummary(task.timeEvents);
      totalActive += activeSeconds;
      totalExpected += task.expectedMinutes * 60;
      if (task.checklistResults.length) {
        checklistTotal += task.checklistResults.length;
        checklistPassed += task.checklistResults.filter((r) => r.result).length;
      }
      if (task.subProcess.isFileRequired && task.status === "COMPLETED") {
        docsRequired += 1;
        if (task.outputRemark && task.checklistResults.length >= 0) {
          docsOk += 1;
        }
      }
      if ((task.dependencySequence ?? 0) > 0) {
        depTotal += 1;
        if (task.status === "COMPLETED") depOk += 1;
      }
    }

    const designs = await prisma.designConcept.findMany({
      where: {
        OR: [
          { designHeadEmployeeId: employee.id },
          { tasks: { some: { assignedEmployeeId: employee.id } } },
        ],
        updatedAtUtc: { gte: start, lt: end },
      },
      include: { costs: true },
    });
    let costScores: number[] = [];
    for (const d of designs) {
      const actual = d.costs.reduce((s, c) => s + Number(c.amount), 0);
      const baseline =
        d.estimatedCost != null
          ? Number(d.estimatedCost)
          : d.standardCost != null
            ? Number(d.standardCost)
            : null;
      if (baseline != null && baseline > 0 && actual > 0) {
        costScores.push(Math.max(0, Math.min(100, (1 - Math.abs(actual - baseline) / baseline) * 100)));
      }
    }

    const scores: Record<string, number> = {
      ON_TIME_COMPLETION: completed.length ? (onTime / completed.length) * 100 : 100,
      QUALITY_APPROVAL: checklistTotal
        ? (checklistPassed / checklistTotal) * 100
        : completed.length
          ? 80
          : 0,
      FIRST_TIME_RIGHT: completed.length ? (firstTimeRight / completed.length) * 100 : 100,
      CORRECTION_PERFORMANCE: Math.max(0, 100 - mistakeCorrections.length * 12),
      CREATIVITY: completed.length ? Math.min(100, 70 + firstTimeRight * 2) : 0,
      COST_CONTROL: costScores.length
        ? costScores.reduce((a, b) => a + b, 0) / costScores.length
        : 70,
      TEAM_COORDINATION: depTotal ? (depOk / depTotal) * 100 : completed.length ? 85 : 70,
      PRODUCTIVITY: totalExpected ? Math.min(100, (totalExpected / Math.max(totalActive, 1)) * 100) : 0,
      DOCUMENTATION: docsRequired ? (docsOk / docsRequired) * 100 : 100,
    };

    for (const metric of metrics) {
      const score = scores[metric.code] ?? 0;
      const weightedScore = (score * metric.weight) / 100;

      const existing = await prisma.employeeKpiScore.findFirst({
        where: {
          employeeId: employee.id,
          periodYear: year,
          periodMonth: month,
          metricCode: metric.code,
        },
      });

      if (existing) {
        await prisma.employeeKpiScore.update({
          where: { id: existing.id },
          data: {
            score,
            weightedScore,
            calculationVersion: KPI_CALCULATION_VERSION,
            calculatedAtUtc: new Date(),
          },
        });
      } else {
        await prisma.employeeKpiScore.create({
          data: {
            employeeId: employee.id,
            periodYear: year,
            periodMonth: month,
            metricCode: metric.code,
            score,
            weightedScore,
            calculationVersion: KPI_CALCULATION_VERSION,
          },
        });
      }

      results.push({ employeeId: employee.id, metricCode: metric.code, score, weightedScore });
    }
  }

  return results;
}

export async function getProcessMasters() {
  return prisma.designProcessMaster.findMany({
    where: { active: true },
    orderBy: { sequence: "asc" },
    include: {
      subProcesses: {
        where: { active: true },
        orderBy: { sequence: "asc" },
      },
    },
  });
}

export async function getAdminDashboardStats() {
  const [
    totalIdeas,
    underDevelopment,
    correctionsOpen,
    approved,
    released,
    avgLeadTime,
  ] = await Promise.all([
    prisma.designConcept.count(),
    prisma.designConcept.count({
      where: { status: { in: ["ACTIVE", "APPROVAL_PENDING", "ON_HOLD"] } },
    }),
    prisma.designCorrection.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.designConcept.count({ where: { status: "APPROVED" } }),
    prisma.designConcept.count({ where: { status: "PRODUCTION_RELEASED" } }),
    prisma.designConcept.findMany({
      where: { status: { in: ["APPROVED", "PRODUCTION_RELEASED", "LIVE"] } },
      select: { createdAtUtc: true, updatedAtUtc: true },
    }),
  ]);

  const leadDays =
    avgLeadTime.length > 0
      ? avgLeadTime.reduce((sum, d) => {
          const days = (d.updatedAtUtc.getTime() - d.createdAtUtc.getTime()) / 86_400_000;
          return sum + days;
        }, 0) / avgLeadTime.length
      : 0;

  return {
    totalIdeas,
    underDevelopment,
    correctionsOpen,
    approved,
    released,
    averageLeadTimeDays: Math.round(leadDays * 10) / 10,
  };
}

export async function getCorrectionAnalysisReport() {
  const corrections = await prisma.designCorrection.findMany({
    include: {
      design: { select: { ideaRef: true, collectionName: true } },
      task: {
        select: {
          subProcess: { select: { name: true, code: true } },
          process: { select: { name: true } },
        },
      },
      responsibleEmployee: { select: { name: true, employeeCode: true } },
    },
    orderBy: { createdAtUtc: "desc" },
    take: 200,
  });

  const byType: Record<string, number> = {};
  let totalExtraMinutes = 0;
  let totalExtraCost = 0;
  for (const c of corrections) {
    byType[c.correctionType] = (byType[c.correctionType] ?? 0) + 1;
    totalExtraMinutes += c.extraMinutes ?? 0;
    totalExtraCost += Number(c.extraCost ?? 0);
  }

  return { corrections, summary: { byType, totalExtraMinutes, totalExtraCost } };
}

export async function getDesignSuccessReport(year: number, month: number) {
  return prisma.designSuccessMetric.findMany({
    where: { periodYear: year, periodMonth: month },
    include: {
      design: {
        select: {
          id: true,
          ideaRef: true,
          designNumber: true,
          collectionName: true,
          productType: { select: { name: true } },
        },
      },
    },
    orderBy: { salesValue: "desc" },
  });
}
