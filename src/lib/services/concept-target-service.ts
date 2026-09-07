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
  percent: number;
  periodYear: number;
  periodMonth: number;
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

export async function getConceptTargetAttainment({
  year,
  month,
}: ConceptTargetPeriod): Promise<ConceptTargetAttainment> {
  const targets = await listConceptTargets({ year, month });
  const targetCount = targets.reduce(
    (sum: number, row: { targetCount: number }) => sum + row.targetCount,
    0,
  );
  const createdAtUtc = monthBounds(year, month);

  const hasGlobal = targets.some(
    (t: { seasonId: number | null; productTypeId: number | null }) =>
      t.seasonId == null && t.productTypeId == null,
  );

  let createdCount: number;
  if (targets.length === 0 || hasGlobal) {
    createdCount = await prisma.designConcept.count({
      where: { createdAtUtc },
    });
  } else {
    createdCount = await prisma.designConcept.count({
      where: {
        createdAtUtc,
        OR: targets.map(
          (t: { seasonId: number | null; productTypeId: number | null }) => ({
            ...(t.seasonId != null ? { seasonId: t.seasonId } : {}),
            ...(t.productTypeId != null ? { productTypeId: t.productTypeId } : {}),
          }),
        ),
      },
    });
  }

  const percent =
    targetCount > 0 ? Math.min(999, Math.round((createdCount / targetCount) * 100)) : 0;

  return {
    targetCount,
    createdCount,
    percent,
    periodYear: year,
    periodMonth: month,
  };
}
