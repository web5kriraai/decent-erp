import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { writeAuditLogDirect } from "@/lib/audit";
import { MISTAKE_CORRECTION_TYPES } from "@/lib/kpi-metrics";
import { appendPerformanceMark } from "@/lib/services/performance-service";

export type DesignContributorScore = {
  employeeId: number;
  name: string;
  score: number;
  maxScore: number;
  /** reworkActive / (original + rework) across corrections where this user is responsible (KPI blame). */
  reworkBurdenPercent: number | null;
  /** Merged Prior+Rework active seconds when this user is the rework assignee. */
  mergedReworkActiveSeconds: number;
};

/** Design-scoped 0–100 contribution score for each contributor. */
export async function getDesignTeamContribution(
  designId: bigint,
): Promise<DesignContributorScore[]> {
  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    include: {
      designHead: { select: { id: true, name: true } },
      tasks: {
        include: {
          assignedEmployee: { select: { id: true, name: true } },
          corrections: true,
          subProcess: { select: { isFileRequired: true } },
          artifacts: { select: { id: true } },
        },
      },
      corrections: true,
      costs: true,
      creativityRatings: true,
    },
  });
  if (!design) throw new ApiError("Design not found", 404);

  const people = new Map<number, string>();
  people.set(design.designHead.id, design.designHead.name);
  for (const task of design.tasks) {
    if (task.assignedEmployee) {
      people.set(task.assignedEmployee.id, task.assignedEmployee.name);
    }
  }
  for (const c of design.corrections) {
    if (c.responsibleEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: c.responsibleEmployeeId },
        select: { id: true, name: true },
      });
      if (emp) people.set(emp.id, emp.name);
    }
    if (c.reworkAssigneeEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: c.reworkAssigneeEmployeeId },
        select: { id: true, name: true },
      });
      if (emp) people.set(emp.id, emp.name);
    }
  }

  const { attachCorrectionTimeBreakdowns } = await import(
    "@/lib/services/correction-time-service"
  );
  const correctionsWithTime = await attachCorrectionTimeBreakdowns(design.corrections);

  const results: DesignContributorScore[] = [];

  for (const [employeeId, name] of people) {
    const myTasks = design.tasks.filter((t) => t.assignedEmployeeId === employeeId);
    const completed = myTasks.filter((t) => t.status === "COMPLETED");
    const onTime = completed.filter(
      (t) => t.completedAt && t.dueAt && t.completedAt <= t.dueAt,
    ).length;
    const onTimeScore = completed.length ? (onTime / completed.length) * 100 : 70;

    const myMistakes = design.corrections.filter(
      (c) =>
        MISTAKE_CORRECTION_TYPES.includes(
          c.correctionType as (typeof MISTAKE_CORRECTION_TYPES)[number],
        ) &&
        (c.responsibleEmployeeId === employeeId ||
          (!c.responsibleEmployeeId &&
            myTasks.some((t) => t.id === c.taskId))),
    );
    const ratingImpact = myMistakes.reduce(
      (s, c) => s + Number(c.ratingImpact ?? -5),
      0,
    );
    const ftrScore = completed.length
      ? ((completed.length - myMistakes.filter((m) =>
          completed.some((t) => t.id === m.taskId),
        ).length) /
          completed.length) *
        100
      : 80;
    const correctionScore = Math.max(0, Math.min(100, 100 + ratingImpact));

    const creativity = design.creativityRatings.find((r) => r.employeeId === employeeId);
    const creativityScore = creativity
      ? Number(creativity.score)
      : completed.length
        ? Math.min(100, 70 + onTime * 2)
        : 60;

    const docsRequired = myTasks.filter(
      (t) => t.subProcess.isFileRequired && t.status === "COMPLETED",
    );
    const docsOk = docsRequired.filter(
      (t) => t.artifacts.length > 0 || !!t.outputRemark,
    ).length;
    const docsScore = docsRequired.length ? (docsOk / docsRequired.length) * 100 : 80;

    const enteredCosts = design.costs.filter((c) => c.enteredById === employeeId);
    let costScore = 70;
    if (enteredCosts.length || design.designHeadEmployeeId === employeeId) {
      const actual = design.costs.reduce((s, c) => s + Number(c.amount), 0);
      const baseline =
        design.estimatedCost != null
          ? Number(design.estimatedCost)
          : design.standardCost != null
            ? Number(design.standardCost)
            : null;
      if (baseline != null && baseline > 0 && actual > 0) {
        costScore = Math.max(
          0,
          Math.min(100, (1 - Math.abs(actual - baseline) / baseline) * 100),
        );
      }
    }

    const responsibleLoops = correctionsWithTime.filter(
      (c) => c.responsibleEmployeeId === employeeId,
    );
    let originalSum = 0;
    let reworkSum = 0;
    for (const c of responsibleLoops) {
      originalSum += c.timeBreakdown.originalActiveSeconds;
      reworkSum += c.timeBreakdown.reworkActiveSeconds;
    }
    const loopTotal = originalSum + reworkSum;
    const reworkBurdenPercent =
      loopTotal > 0 ? Math.round((reworkSum / loopTotal) * 1000) / 10 : null;

    const mergedReworkActiveSeconds = correctionsWithTime
      .filter(
        (c) =>
          (c.reworkAssigneeEmployeeId ?? c.responsibleEmployeeId) === employeeId,
      )
      .reduce((s, c) => s + c.timeBreakdown.totalActiveSeconds, 0);

    const score = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          onTimeScore * 0.25 +
            ftrScore * 0.2 +
            correctionScore * 0.2 +
            creativityScore * 0.15 +
            costScore * 0.1 +
            docsScore * 0.1,
        ),
      ),
    );

    results.push({
      employeeId,
      name,
      score,
      maxScore: 100,
      reworkBurdenPercent,
      mergedReworkActiveSeconds,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

export async function upsertDesignCreativityRating(input: {
  designId: bigint;
  employeeId: number;
  score: number;
  remark?: string | null;
  ratedById: number;
  correlationId: string;
}) {
  if (input.score < 0 || input.score > 100) {
    throw new ApiError("Creativity score must be between 0 and 100", 422);
  }

  const design = await prisma.designConcept.findUnique({
    where: { id: input.designId },
    select: { id: true, designHeadEmployeeId: true },
  });
  if (!design) throw new ApiError("Design not found", 404);

  const existing = await prisma.designCreativityRating.findUnique({
    where: {
      designId_employeeId: {
        designId: input.designId,
        employeeId: input.employeeId,
      },
    },
  });

  const rating = existing
    ? await prisma.designCreativityRating.update({
        where: { id: existing.id },
        data: {
          score: input.score,
          remark: input.remark ?? null,
          ratedById: input.ratedById,
          ratedAtUtc: new Date(),
        },
      })
    : await prisma.designCreativityRating.create({
        data: {
          designId: input.designId,
          employeeId: input.employeeId,
          ratedById: input.ratedById,
          score: input.score,
          remark: input.remark ?? null,
        },
      });

  const priorDelta = existing ? Number(existing.score) * 0.1 : 0;
  const newDelta = input.score * 0.1;
  await appendPerformanceMark({
    employeeId: input.employeeId,
    sourceType: "CREATIVITY_RATING",
    sourceRef: `design:${input.designId.toString()}:emp:${input.employeeId}`,
    pointsDelta: newDelta - priorDelta,
    note: `Creativity rating ${input.score}/100 on design ${input.designId.toString()}`,
    createdById: input.ratedById,
  });

  await writeAuditLogDirect({
    entityType: "DesignCreativityRating",
    entityId: rating.id.toString(),
    action: existing ? "UPDATE" : "CREATE",
    userId: input.ratedById,
    correlationId: input.correlationId,
    before: existing ?? undefined,
    after: rating,
  });

  return rating;
}
