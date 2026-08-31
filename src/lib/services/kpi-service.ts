import { prisma } from "@/lib/db";

const CALCULATION_VERSION = 1;

const METRICS = [
  { code: "TASK_ON_TIME", weight: 25 },
  { code: "CORRECTION_RATE", weight: 20 },
  { code: "ACTIVE_TIME_RATIO", weight: 20 },
  { code: "HOLD_TIME_RATIO", weight: 15 },
  { code: "TASK_COMPLETION", weight: 20 },
] as const;

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
  return prisma.employeeKpiScore.findMany({
    where: {
      employee: { role: { code: "DESIGN_HEAD" } },
    },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: {
      employee: { select: { id: true, name: true, employeeCode: true } },
    },
  });
}

export async function calculateMonthlyKpi(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true },
  });

  const results = [];

  for (const employee of employees) {
    const tasks = await prisma.designTask.findMany({
      where: {
        assignedEmployeeId: employee.id,
        updatedAtUtc: { gte: start, lt: end },
      },
      include: { timeEvents: true, corrections: true },
    });

    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const onTime = tasks.filter(
      (t) => t.completedAt && t.dueAt && t.completedAt <= t.dueAt,
    ).length;
    const correctionCount = tasks.reduce((sum, t) => sum + t.corrections.length, 0);

    const scores: Record<string, number> = {
      TASK_ON_TIME: tasks.length ? (onTime / tasks.length) * 100 : 100,
      CORRECTION_RATE: Math.max(0, 100 - correctionCount * 10),
      ACTIVE_TIME_RATIO: 85,
      HOLD_TIME_RATIO: 80,
      TASK_COMPLETION: tasks.length ? (completed / tasks.length) * 100 : 0,
    };

    for (const metric of METRICS) {
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
            calculationVersion: CALCULATION_VERSION,
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
            calculationVersion: CALCULATION_VERSION,
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
