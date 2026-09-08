import { prisma } from "@/lib/db";
import {
  KPI_CALCULATION_VERSION,
  MISTAKE_CORRECTION_TYPES,
  SPEC_KPI_METRICS,
} from "@/lib/kpi-metrics";
import { computeTimeSummary } from "@/lib/services/time-calculation";
import { countOpenCorrectionsForEmployee } from "@/lib/services/correction-service";
import {
  getLatestMarkBalance,
  upsertMonthlyKpiMark,
  upsertPerformanceGrade,
} from "@/lib/services/performance-service";

const kpiScoreInclude = {
  employee: {
    select: {
      id: true,
      name: true,
      employeeCode: true,
      role: { select: { code: true } },
    },
  },
} as const;

export async function getEmployeeKpiDashboard(employeeId?: number) {
  const where = employeeId ? { employeeId } : {};
  return prisma.employeeKpiScore.findMany({
    where,
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { id: "desc" }],
    include: kpiScoreInclude,
  });
}

/** Paginated employee KPI scores with aggregates for dashboard stats/chart. */
export async function listEmployeeKpiScores(filters: {
  employeeId?: number;
  limit?: number;
  offset?: number;
}) {
  const rawLimit = Number(filters.limit ?? 25);
  const rawOffset = Number(filters.offset ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 25;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;
  const where = filters.employeeId ? { employeeId: filters.employeeId } : {};

  const [items, total, byEmployee, byMetric] = await Promise.all([
    prisma.employeeKpiScore.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { id: "desc" }],
      include: kpiScoreInclude,
    }),
    prisma.employeeKpiScore.count({ where }),
    prisma.employeeKpiScore.groupBy({
      by: ["employeeId"],
      where,
      _sum: { weightedScore: true },
      _count: { _all: true },
    }),
    prisma.employeeKpiScore.groupBy({
      by: ["metricCode"],
      where,
      _count: { _all: true },
      _avg: { score: true },
    }),
  ]);

  const employeeIds = byEmployee.map((row) => row.employeeId);
  const now = new Date();
  const periodYear = now.getUTCFullYear();
  const periodMonth = now.getUTCMonth() + 1;

  const employees =
    employeeIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true },
        })
      : [];

  const grades =
    employeeIds.length > 0
      ? await prisma.employeePerformanceGrade.findMany({
          where: {
            employeeId: { in: employeeIds },
            periodYear,
            periodMonth,
          },
          select: {
            employeeId: true,
            gradeCode: true,
            totalMarks: true,
          },
        })
      : [];

  const nameById = new Map(employees.map((e) => [e.id, e.name]));
  const gradeById = new Map(
    grades.map((g) => [
      g.employeeId,
      { gradeCode: g.gradeCode, marksBalance: Number(g.totalMarks) },
    ]),
  );

  const chart = byEmployee
    .map((row) => {
      const grade = gradeById.get(row.employeeId);
      return {
        employeeId: row.employeeId,
        name: (nameById.get(row.employeeId) ?? `Emp ${row.employeeId}`).split(" ")[0],
        score: Number(row._sum.weightedScore ?? 0),
        gradeCode: grade?.gradeCode ?? null,
        marksBalance: grade?.marksBalance ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);

  const metricCounts = Object.fromEntries(
    byMetric.map((row) => [row.metricCode, row._count._all]),
  ) as Record<string, number>;

  const metricAverages = Object.fromEntries(
    byMetric.map((row) => [
      row.metricCode,
      row._avg.score != null ? Number(row._avg.score) : null,
    ]),
  ) as Record<string, number | null>;

  return {
    items,
    total,
    limit,
    offset,
    summary: {
      scoreRecordCount: total,
      employeeCount: byEmployee.length,
      chart,
      metricCounts,
      metricAverages,
    },
  };
}

export async function getDesignHeadKpi(input?: {
  employeeId?: number;
  roleCode?: string | null;
}) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const period = {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };

  const portfolio =
    input?.roleCode === "DESIGN_HEAD" && input.employeeId
      ? { designHeadEmployeeId: input.employeeId }
      : {};

  const approvedStatuses = ["APPROVED", "PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"] as const;
  const releasedStatuses = ["PRODUCTION_RELEASED", "LIVE"] as const;

  const [designsCreated, approvedInPeriod, releasedSnapshot, liveSnapshot, teamScores] =
    await Promise.all([
      prisma.designConcept.count({
        where: { createdAtUtc: period, ...portfolio },
      }),
      prisma.designConcept.count({
        where: {
          createdAtUtc: period,
          status: { in: [...approvedStatuses] },
          ...portfolio,
        },
      }),
      prisma.designConcept.count({
        where: { status: { in: [...releasedStatuses] }, ...portfolio },
      }),
      prisma.designConcept.count({
        where: { status: "LIVE", ...portfolio },
      }),
      getEmployeeKpiDashboard(),
    ]);

  const conversionRate = designsCreated
    ? Math.round((approvedInPeriod / designsCreated) * 100)
    : 0;

  return {
    periodYear: year,
    periodMonth: month,
    ideasCreated: designsCreated,
    approvedCount: approvedInPeriod,
    releasedCount: releasedSnapshot,
    liveCount: liveSnapshot,
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
        artifacts: { select: { id: true } },
      },
    });

    const responsibleCorrections = await prisma.designCorrection.findMany({
      where: {
        responsibleEmployeeId: employee.id,
        createdAtUtc: { gte: start, lt: end },
      },
    });

    const completed = tasks.filter((t) => t.status === "COMPLETED");
    const onTime = completed.filter(
      (t) => t.completedAt && t.dueAt && t.completedAt <= t.dueAt,
    ).length;

    const mistakeCorrections =
      responsibleCorrections.length > 0
        ? responsibleCorrections.filter((c) =>
            MISTAKE_CORRECTION_TYPES.includes(
              c.correctionType as (typeof MISTAKE_CORRECTION_TYPES)[number],
            ),
          )
        : tasks.flatMap((t) =>
            t.corrections.filter((c) =>
              MISTAKE_CORRECTION_TYPES.includes(
                c.correctionType as (typeof MISTAKE_CORRECTION_TYPES)[number],
              ),
            ),
          );

    const ratingImpactSum = mistakeCorrections.reduce(
      (sum, c) => sum + Number(c.ratingImpact ?? -5),
      0,
    );

    const firstTimeRight = completed.filter(
      (t) =>
        !t.corrections.some((c) =>
          MISTAKE_CORRECTION_TYPES.includes(c.correctionType as never),
        ),
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
        if (task.outputRemark || task.artifacts.length > 0) {
          docsOk += 1;
        }
      }
      if ((task.dependencySequence ?? 0) > 0) {
        depTotal += 1;
        if (task.status === "COMPLETED") depOk += 1;
      }
    }

    // Rework assignees: prefer merged Prior+Rework loop hours for productivity.
    const reworkCorrections = await prisma.designCorrection.findMany({
      where: {
        reworkAssigneeEmployeeId: employee.id,
        createdAtUtc: { gte: start, lt: end },
      },
      select: {
        id: true,
        taskId: true,
        routedTaskId: true,
        createdAtUtc: true,
        reworkAssigneeEmployeeId: true,
        responsibleEmployeeId: true,
      },
    });
    if (reworkCorrections.length > 0) {
      const { attachCorrectionTimeBreakdowns } = await import(
        "@/lib/services/correction-time-service"
      );
      const withTime = await attachCorrectionTimeBreakdowns(reworkCorrections);
      const merged = withTime.reduce(
        (sum, c) => sum + c.timeBreakdown.totalActiveSeconds,
        0,
      );
      if (merged > 0) {
        totalActive = Math.max(totalActive, merged);
      }
    }

    const designIds = [
      ...new Set(
        (
          await prisma.designTask.findMany({
            where: { assignedEmployeeId: employee.id },
            select: { designId: true },
            distinct: ["designId"],
          })
        ).map((t) => t.designId),
      ),
    ];

    const approvals =
      designIds.length > 0
        ? await prisma.designApproval.findMany({
            where: {
              designId: { in: designIds },
              OR: [
                { approverEmployeeId: employee.id },
                { design: { tasks: { some: { assignedEmployeeId: employee.id } } } },
              ],
              decisionAtUtc: { gte: start, lt: end },
            },
          })
        : [];
    const approvalDecided = approvals.filter((a) => a.decision !== "PENDING");
    const approvalApproved = approvalDecided.filter((a) => a.decision === "APPROVED").length;
    const approvalRate = approvalDecided.length
      ? (approvalApproved / approvalDecided.length) * 100
      : null;
    const checklistRate = checklistTotal
      ? (checklistPassed / checklistTotal) * 100
      : null;
    let qualityScore = 0;
    if (checklistRate != null && approvalRate != null) {
      qualityScore = checklistRate * 0.5 + approvalRate * 0.5;
    } else if (checklistRate != null) {
      qualityScore = checklistRate;
    } else if (approvalRate != null) {
      qualityScore = approvalRate;
    } else if (completed.length) {
      qualityScore = 80;
    }

    const creativityRatings = await prisma.designCreativityRating.findMany({
      where: {
        employeeId: employee.id,
        ratedAtUtc: { gte: start, lt: end },
      },
    });
    const creativityFromRatings = creativityRatings.length
      ? creativityRatings.reduce((s, r) => s + Number(r.score), 0) /
        creativityRatings.length
      : null;

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
    const costScores: number[] = [];
    for (const d of designs) {
      const actual = d.costs.reduce((s, c) => s + Number(c.amount), 0);
      const baseline =
        d.estimatedCost != null
          ? Number(d.estimatedCost)
          : d.standardCost != null
            ? Number(d.standardCost)
            : null;
      if (baseline != null && baseline > 0 && actual > 0) {
        costScores.push(
          Math.max(0, Math.min(100, (1 - Math.abs(actual - baseline) / baseline) * 100)),
        );
      }
    }

    const correctionPerformance = Math.max(
      0,
      Math.min(100, 100 + ratingImpactSum - mistakeCorrections.length * 2),
    );

    const scores: Record<string, number> = {
      ON_TIME_COMPLETION: completed.length ? (onTime / completed.length) * 100 : 100,
      QUALITY_APPROVAL: qualityScore,
      FIRST_TIME_RIGHT: completed.length
        ? (firstTimeRight / completed.length) * 100
        : 100,
      CORRECTION_PERFORMANCE: correctionPerformance,
      CREATIVITY:
        creativityFromRatings != null
          ? creativityFromRatings
          : completed.length
            ? Math.min(100, 70 + firstTimeRight * 2)
            : 0,
      COST_CONTROL: costScores.length
        ? costScores.reduce((a, b) => a + b, 0) / costScores.length
        : 70,
      TEAM_COORDINATION: depTotal
        ? (depOk / depTotal) * 100
        : completed.length
          ? 85
          : 70,
      PRODUCTIVITY: totalExpected
        ? Math.min(100, (totalExpected / Math.max(totalActive, 1)) * 100)
        : 0,
      DOCUMENTATION: docsRequired ? (docsOk / docsRequired) * 100 : 100,
    };

    let weightedTotal = 0;

    for (const metric of metrics) {
      const score = scores[metric.code] ?? 0;
      const weightedScore = (score * metric.weight) / 100;
      weightedTotal += weightedScore;

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

    await upsertMonthlyKpiMark({
      employeeId: employee.id,
      periodYear: year,
      periodMonth: month,
      weightedTotal,
    });
    const marksBalance = await getLatestMarkBalance(employee.id);
    await upsertPerformanceGrade({
      employeeId: employee.id,
      periodYear: year,
      periodMonth: month,
      weightedKpiScore: weightedTotal,
      totalMarks: marksBalance,
    });
  }

  return results;
}

export async function getProcessMasters(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive === true;
  return prisma.designProcessMaster.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { sequence: "asc" },
    include: {
      subProcesses: {
        where: includeInactive ? undefined : { active: true },
        orderBy: { sequence: "asc" },
      },
    },
  });
}

export async function getAdminDashboardStats(employeeId: number) {
  const [
    totalIdeas,
    underDevelopment,
    myOpenCorrections,
    approved,
    released,
    avgLeadTime,
  ] = await Promise.all([
    prisma.designConcept.count(),
    prisma.designConcept.count({
      where: { status: { in: ["ACTIVE", "APPROVAL_PENDING", "ON_HOLD"] } },
    }),
    countOpenCorrectionsForEmployee(employeeId),
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
    correctionsOpen: myOpenCorrections,
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
      reworkAssignee: { select: { name: true, employeeCode: true } },
      routeToSubProcess: { select: { name: true, code: true } },
    },
    orderBy: { createdAtUtc: "desc" },
    take: 200,
  });

  const { attachCorrectionTimeBreakdowns } = await import(
    "@/lib/services/correction-time-service"
  );
  const withTime = await attachCorrectionTimeBreakdowns(corrections);

  const byType: Record<string, number> = {};
  let totalExtraMinutes = 0;
  let totalExtraCost = 0;
  let totalReworkSeconds = 0;
  for (const c of withTime) {
    byType[c.correctionType] = (byType[c.correctionType] ?? 0) + 1;
    totalExtraMinutes += c.extraMinutes ?? c.timeBreakdown.measuredExtraMinutes ?? 0;
    totalExtraCost += Number(c.extraCost ?? 0);
    totalReworkSeconds += c.timeBreakdown.reworkActiveSeconds;
  }

  return {
    corrections: withTime,
    summary: {
      byType,
      totalExtraMinutes,
      totalExtraCost,
      totalReworkSeconds,
    },
  };
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

function utcMonthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/** Sample Status report: designs by sampleDecision + currentStage for a month. */
export async function getSampleStatusReport(year: number, month: number) {
  const { start, end } = utcMonthRange(year, month);

  const designs = await prisma.designConcept.findMany({
    where: {
      OR: [
        { sampleDecisionAtUtc: { gte: start, lt: end } },
        {
          sampleDecision: null,
          createdAtUtc: { gte: start, lt: end },
        },
      ],
    },
    select: {
      id: true,
      ideaRef: true,
      collectionName: true,
      sampleDecision: true,
      currentStage: true,
      status: true,
      productType: { select: { name: true } },
    },
    orderBy: { updatedAtUtc: "desc" },
    take: 500,
  });

  const byDecision: Record<string, number> = {
    PASS: 0,
    HOLD: 0,
    REJECT: 0,
    PENDING: 0,
  };
  const byStage: Record<string, number> = {};

  for (const d of designs) {
    const decisionKey = d.sampleDecision ?? "PENDING";
    byDecision[decisionKey] = (byDecision[decisionKey] ?? 0) + 1;
    const stageKey = d.currentStage ?? "UNSET";
    byStage[stageKey] = (byStage[stageKey] ?? 0) + 1;
  }

  return {
    year,
    month,
    total: designs.length,
    byDecision,
    byStage,
    designs,
  };
}

/**
 * Production Start report: designs that reached PRODUCTION_RELEASED or
 * PRODUCTION_ACCEPTED in the period, grouped by product type.
 */
export async function getProductionStartReport(year: number, month: number) {
  const { start, end } = utcMonthRange(year, month);

  const designs = await prisma.designConcept.findMany({
    where: {
      status: { in: ["PRODUCTION_RELEASED", "PRODUCTION_ACCEPTED", "LIVE"] },
      OR: [
        { productionHandoffs: { some: { releasedAtUtc: { gte: start, lt: end } } } },
        {
          status: { in: ["PRODUCTION_ACCEPTED", "PRODUCTION_RELEASED", "LIVE"] },
          updatedAtUtc: { gte: start, lt: end },
        },
      ],
    },
    select: {
      id: true,
      ideaRef: true,
      designNumber: true,
      collectionName: true,
      status: true,
      productType: { select: { id: true, code: true, name: true } },
    },
    orderBy: { updatedAtUtc: "desc" },
    take: 500,
  });

  const byProductType: Record<string, { productTypeId: number; name: string; code: string; count: number }> =
    {};

  for (const d of designs) {
    const key = d.productType?.code ?? "UNKNOWN";
    if (!byProductType[key]) {
      byProductType[key] = {
        productTypeId: d.productType?.id ?? 0,
        name: d.productType?.name ?? "Unknown",
        code: key,
        count: 0,
      };
    }
    byProductType[key].count += 1;
  }

  return {
    year,
    month,
    total: designs.length,
    byProductType: Object.values(byProductType).sort((a, b) => b.count - a.count),
    designs,
  };
}
