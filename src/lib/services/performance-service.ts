import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { PerformanceMarkSource } from "@/lib/performance-grade";
import { gradeFromWeightedScore } from "@/lib/performance-grade";
import { KPI_CALCULATION_VERSION } from "@/lib/kpi-metrics";

export async function getLatestMarkBalance(employeeId: number): Promise<number> {
  const latest = await prisma.employeePerformanceMark.findFirst({
    where: { employeeId },
    orderBy: [{ createdAtUtc: "desc" }, { id: "desc" }],
    select: { balanceAfter: true },
  });
  return Number(latest?.balanceAfter ?? 0);
}

export async function appendPerformanceMark(input: {
  employeeId: number;
  sourceType: PerformanceMarkSource;
  sourceRef?: string | null;
  pointsDelta: number;
  note?: string | null;
  createdById?: number | null;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  const prior = await db.employeePerformanceMark.findFirst({
    where: { employeeId: input.employeeId },
    orderBy: [{ createdAtUtc: "desc" }, { id: "desc" }],
    select: { balanceAfter: true },
  });
  const balanceAfter = Number(prior?.balanceAfter ?? 0) + input.pointsDelta;
  return db.employeePerformanceMark.create({
    data: {
      employeeId: input.employeeId,
      sourceType: input.sourceType,
      sourceRef: input.sourceRef ?? null,
      pointsDelta: input.pointsDelta,
      balanceAfter,
      note: input.note ?? null,
      createdById: input.createdById ?? null,
    },
  });
}

/** Replace period KPI_MONTHLY mark for an employee (idempotent recompute). */
export async function upsertMonthlyKpiMark(input: {
  employeeId: number;
  periodYear: number;
  periodMonth: number;
  weightedTotal: number;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  const sourceRef = `${input.periodYear}-${String(input.periodMonth).padStart(2, "0")}`;
  await db.employeePerformanceMark.deleteMany({
    where: {
      employeeId: input.employeeId,
      sourceType: "KPI_MONTHLY",
      sourceRef,
    },
  });
  return appendPerformanceMark({
    employeeId: input.employeeId,
    sourceType: "KPI_MONTHLY",
    sourceRef,
    pointsDelta: input.weightedTotal,
    note: `Monthly weighted KPI ${sourceRef}`,
    tx: input.tx,
  });
}

export async function upsertPerformanceGrade(input: {
  employeeId: number;
  periodYear: number;
  periodMonth: number;
  weightedKpiScore: number;
  totalMarks: number;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx ?? prisma;
  const gradeCode = gradeFromWeightedScore(input.weightedKpiScore);
  return db.employeePerformanceGrade.upsert({
    where: {
      employeeId_periodYear_periodMonth: {
        employeeId: input.employeeId,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
      },
    },
    create: {
      employeeId: input.employeeId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      totalMarks: input.totalMarks,
      gradeCode,
      weightedKpiScore: input.weightedKpiScore,
      calculationVersion: KPI_CALCULATION_VERSION,
    },
    update: {
      totalMarks: input.totalMarks,
      gradeCode,
      weightedKpiScore: input.weightedKpiScore,
      calculationVersion: KPI_CALCULATION_VERSION,
      calculatedAtUtc: new Date(),
    },
  });
}

export async function getEmployeePerformance(employeeId: number, periodYear?: number, periodMonth?: number) {
  const now = new Date();
  const year = periodYear ?? now.getUTCFullYear();
  const month = periodMonth ?? now.getUTCMonth() + 1;

  const [grade, marks, balance] = await Promise.all([
    prisma.employeePerformanceGrade.findUnique({
      where: {
        employeeId_periodYear_periodMonth: {
          employeeId,
          periodYear: year,
          periodMonth: month,
        },
      },
    }),
    prisma.employeePerformanceMark.findMany({
      where: { employeeId },
      orderBy: [{ createdAtUtc: "desc" }, { id: "desc" }],
      take: 50,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    }),
    getLatestMarkBalance(employeeId),
  ]);

  return {
    employeeId,
    periodYear: year,
    periodMonth: month,
    grade,
    marksBalance: balance,
    marks,
  };
}
