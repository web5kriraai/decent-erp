import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import { MASTER_TYPES } from "@/lib/master-catalog-types";
import { requireMasterOfType } from "@/lib/services/master-catalog-service";

export type ConceptTargetPeriod = {
  year: number;
  month: number;
};

export type UpsertConceptTargetInput = {
  periodYear: number;
  periodMonth: number;
  targetCount: number;
  seasonId?: number | null;
  productTypeId?: number | null;
  note?: string | null;
};

export type ConceptTargetAttainment = {
  targetCount: number;
  createdCount: number;
  /** Designs with any sampleDecision recorded in the period (Pass+Hold+Reject). */
  madeCount: number;
  passCount: number;
  holdCount: number;
  rejectCount: number;
  /** Null when no target is configured for the period (avoid fake 0%). */
  percent: number | null;
  /** Pass attainment vs target (commercial wins). Null when no target. */
  passPercent: number | null;
  periodYear: number;
  periodMonth: number;
  /** False when no ConceptTarget rows (or all zero) for the period. */
  hasTarget: boolean;
};

function monthBounds(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

export async function listConceptTargets({ year, month }: ConceptTargetPeriod) {
  return prisma.conceptTarget.findMany({
    where: { periodYear: year, periodMonth: month },
    orderBy: [{ seasonId: "asc" }, { productTypeId: "asc" }],
    include: {
      season: { select: { id: true, code: true, name: true } },
      productType: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true, employeeCode: true } },
    },
  });
}

export async function upsertConceptTarget(
  input: UpsertConceptTargetInput,
  userId: number,
  correlationId?: string,
) {
  const seasonId = input.seasonId ?? null;
  const productTypeId = input.productTypeId ?? null;

  if (seasonId != null) {
    await requireMasterOfType(seasonId, MASTER_TYPES.SEASON);
  }
  if (productTypeId != null) {
    await requireMasterOfType(productTypeId, MASTER_TYPES.PRODUCT_CATEGORY);
  }

  const existing = await prisma.conceptTarget.findFirst({
    where: {
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      seasonId,
      productTypeId,
    },
  });

  if (existing) {
    const updated = await prisma.conceptTarget.update({
      where: { id: existing.id },
      data: {
        targetCount: input.targetCount,
        note: input.note ?? null,
      },
    });
    await writeAuditLogDirect({
      entityType: "ConceptTarget",
      entityId: String(updated.id),
      action: "UPDATE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });
    return updated;
  }

  const created = await prisma.conceptTarget.create({
    data: {
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      targetCount: input.targetCount,
      seasonId,
      productTypeId,
      note: input.note ?? null,
      createdById: userId,
    },
  });
  await writeAuditLogDirect({
    entityType: "ConceptTarget",
    entityId: String(created.id),
    action: "CREATE",
    userId,
    correlationId,
    after: created,
  });
  return created;
}

/**
 * Ensures a global (all seasons / products) monthly target exists.
 * Used by seed so Management/KPI cards never show unset for the current month.
 */
export async function ensureGlobalConceptTargetForPeriod(input: {
  year: number;
  month: number;
  targetCount: number;
  createdById: number;
  note?: string;
}) {
  const existing = await prisma.conceptTarget.findFirst({
    where: {
      periodYear: input.year,
      periodMonth: input.month,
      seasonId: null,
      productTypeId: null,
    },
  });
  if (existing) {
    if (existing.targetCount > 0) return existing;
    return prisma.conceptTarget.update({
      where: { id: existing.id },
      data: { targetCount: input.targetCount, note: input.note ?? existing.note },
    });
  }
  return prisma.conceptTarget.create({
    data: {
      periodYear: input.year,
      periodMonth: input.month,
      targetCount: input.targetCount,
      note: input.note ?? null,
      createdById: input.createdById,
    },
  });
}

export async function getConceptTargetAttainment({
  year,
  month,
  designHeadEmployeeId,
}: ConceptTargetPeriod & {
  /** When set, count only designs owned by this Design Head. */
  designHeadEmployeeId?: number;
}): Promise<ConceptTargetAttainment> {
  const targets = await listConceptTargets({ year, month });
  const targetCount = targets.reduce(
    (sum: number, row: { targetCount: number }) => sum + row.targetCount,
    0,
  );
  const hasTarget = targets.length > 0 && targetCount > 0;
  const createdAtUtc = monthBounds(year, month);
  const portfolio =
    designHeadEmployeeId != null ? { designHeadEmployeeId } : {};

  const hasGlobal = targets.some(
    (t: { seasonId: number | null; productTypeId: number | null }) =>
      t.seasonId == null && t.productTypeId == null,
  );

  let createdCount: number;
  if (targets.length === 0 || hasGlobal) {
    createdCount = await prisma.designConcept.count({
      where: { createdAtUtc, ...portfolio },
    });
  } else {
    createdCount = await prisma.designConcept.count({
      where: {
        createdAtUtc,
        ...portfolio,
        OR: targets.map(
          (t: { seasonId: number | null; productTypeId: number | null }) => ({
            ...(t.seasonId != null ? { seasonId: t.seasonId } : {}),
            ...(t.productTypeId != null ? { productTypeId: t.productTypeId } : {}),
          }),
        ),
      },
    });
  }

  const decisionBaseWhere =
    targets.length === 0 || hasGlobal
      ? { sampleDecisionAtUtc: createdAtUtc, ...portfolio }
      : {
          sampleDecisionAtUtc: createdAtUtc,
          ...portfolio,
          OR: targets.map(
            (t: { seasonId: number | null; productTypeId: number | null }) => ({
              ...(t.seasonId != null ? { seasonId: t.seasonId } : {}),
              ...(t.productTypeId != null ? { productTypeId: t.productTypeId } : {}),
            }),
          ),
        };

  const [passCount, holdCount, rejectCount] = await Promise.all([
    prisma.designConcept.count({
      where: { ...decisionBaseWhere, sampleDecision: "PASS" },
    }),
    prisma.designConcept.count({
      where: { ...decisionBaseWhere, sampleDecision: "HOLD" },
    }),
    prisma.designConcept.count({
      where: { ...decisionBaseWhere, sampleDecision: "REJECT" },
    }),
  ]);
  const madeCount = passCount + holdCount + rejectCount;

  const percent = hasTarget
    ? Math.min(999, Math.round((createdCount / targetCount) * 100))
    : null;
  const passPercent = hasTarget
    ? Math.min(999, Math.round((passCount / targetCount) * 100))
    : null;

  return {
    targetCount,
    createdCount,
    madeCount,
    passCount,
    holdCount,
    rejectCount,
    percent,
    passPercent,
    periodYear: year,
    periodMonth: month,
    hasTarget,
  };
}
