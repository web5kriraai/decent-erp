import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors/api-error";
import { SPEC_KPI_METRICS } from "@/lib/kpi-metrics";

export type MetricWeights = Record<string, number>;

function normalizeWeights(raw: unknown): MetricWeights {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError("metricWeights must be an object of metricCode → weight", 400);
  }
  const weights: MetricWeights = {};
  let total = 0;
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new ApiError(`Invalid weight for ${code}`, 400);
    }
    weights[code] = n;
    total += n;
  }
  if (Math.abs(total - 100) > 0.51) {
    throw new ApiError(`Scorecard weights must sum to 100 (got ${total.toFixed(1)})`, 400);
  }
  return weights;
}

/** Role / company benchmark from stored EmployeeKpiScore rows. */
export async function getKpiBenchmark(input: {
  companyId: number;
  year: number;
  month: number;
  roleId?: number;
}) {
  const scores = await prisma.employeeKpiScore.findMany({
    where: {
      periodYear: input.year,
      periodMonth: input.month,
      employee: {
        companyId: input.companyId,
        ...(input.roleId != null ? { roleId: input.roleId } : {}),
      },
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
          roleId: true,
          role: { select: { code: true, name: true } },
        },
      },
    },
  });

  const byMetric = new Map<string, number[]>();
  const byEmployee = new Map<
    number,
    { name: string; code: string; roleCode: string; weightedTotal: number }
  >();

  for (const row of scores) {
    const list = byMetric.get(row.metricCode) ?? [];
    list.push(Number(row.score));
    byMetric.set(row.metricCode, list);

    const emp = byEmployee.get(row.employeeId) ?? {
      name: row.employee.name,
      code: row.employee.employeeCode,
      roleCode: row.employee.role.code,
      weightedTotal: 0,
    };
    emp.weightedTotal += Number(row.weightedScore);
    byEmployee.set(row.employeeId, emp);
  }

  const metrics = SPEC_KPI_METRICS.map((m) => {
    const values = (byMetric.get(m.code) ?? []).sort((a, b) => a - b);
    const avg =
      values.length > 0
        ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
        : null;
    const p50 =
      values.length > 0
        ? values[Math.floor((values.length - 1) * 0.5)]!
        : null;
    const p90 =
      values.length > 0
        ? values[Math.floor((values.length - 1) * 0.9)]!
        : null;
    return {
      metricCode: m.code,
      label: m.label,
      weight: m.weight,
      sampleSize: values.length,
      average: avg,
      p50,
      p90,
    };
  });

  const ranked = [...byEmployee.entries()]
    .map(([employeeId, row]) => ({
      employeeId,
      name: row.name,
      employeeCode: row.code,
      roleCode: row.roleCode,
      weightedTotal: Math.round(row.weightedTotal * 10) / 10,
    }))
    .sort((a, b) => b.weightedTotal - a.weightedTotal);

  const teamAvg =
    ranked.length > 0
      ? Math.round(
          (ranked.reduce((s, r) => s + r.weightedTotal, 0) / ranked.length) * 10,
        ) / 10
      : null;

  return {
    year: input.year,
    month: input.month,
    roleId: input.roleId ?? null,
    employeeCount: ranked.length,
    teamAverageWeighted: teamAvg,
    metrics,
    employees: ranked.map((r) => ({
      ...r,
      vsTeamAvg:
        teamAvg != null ? Math.round((r.weightedTotal - teamAvg) * 10) / 10 : null,
    })),
  };
}

export async function listScorecards(companyId: number) {
  return prisma.kpiScorecard.findMany({
    where: { companyId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      role: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function createScorecard(input: {
  companyId: number;
  createdById: number;
  code: string;
  name: string;
  description?: string;
  roleId?: number | null;
  metricWeights: unknown;
}) {
  const metricWeights = normalizeWeights(input.metricWeights);
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "_");
  return prisma.kpiScorecard.create({
    data: {
      companyId: input.companyId,
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      roleId: input.roleId ?? null,
      metricWeights,
      createdById: input.createdById,
    },
  });
}

export async function applyScorecardBenchmark(input: {
  companyId: number;
  scorecardId: number;
  year: number;
  month: number;
}) {
  const card = await prisma.kpiScorecard.findFirst({
    where: { id: input.scorecardId, companyId: input.companyId, active: true },
  });
  if (!card) throw new ApiError("Scorecard not found", 404);

  const benchmark = await getKpiBenchmark({
    companyId: input.companyId,
    year: input.year,
    month: input.month,
    roleId: card.roleId ?? undefined,
  });

  const weights = card.metricWeights as MetricWeights;
  const employees = await prisma.employeeKpiScore.findMany({
    where: {
      periodYear: input.year,
      periodMonth: input.month,
      employee: {
        companyId: input.companyId,
        ...(card.roleId != null ? { roleId: card.roleId } : {}),
      },
    },
    include: {
      employee: { select: { id: true, name: true, employeeCode: true } },
    },
  });

  const byEmp = new Map<
    number,
    { name: string; code: string; scores: Record<string, number> }
  >();
  for (const row of employees) {
    const cur = byEmp.get(row.employeeId) ?? {
      name: row.employee.name,
      code: row.employee.employeeCode,
      scores: {},
    };
    cur.scores[row.metricCode] = Number(row.score);
    byEmp.set(row.employeeId, cur);
  }

  const scored = [...byEmp.entries()].map(([employeeId, row]) => {
    let total = 0;
    for (const [code, weight] of Object.entries(weights)) {
      const score = row.scores[code] ?? 0;
      total += (score * weight) / 100;
    }
    return {
      employeeId,
      name: row.name,
      employeeCode: row.code,
      scorecardTotal: Math.round(total * 10) / 10,
    };
  });
  scored.sort((a, b) => b.scorecardTotal - a.scorecardTotal);

  return {
    scorecard: {
      id: card.id,
      code: card.code,
      name: card.name,
      metricWeights: weights,
    },
    year: input.year,
    month: input.month,
    ranking: scored,
    roleBenchmark: benchmark,
  };
}
