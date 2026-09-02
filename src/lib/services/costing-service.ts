import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

const COST_TYPES = ["TIME", "MATERIAL", "MACHINE", "CORRECTION"] as const;
export type CostType = (typeof COST_TYPES)[number];

export function isValidCostType(type: string): type is CostType {
  return COST_TYPES.includes(type as CostType);
}

export async function listDesignCosts(designId: bigint) {
  return prisma.designCost.findMany({
    where: { designId },
    include: {
      enteredBy: { select: { id: true, name: true, employeeCode: true } },
    },
    orderBy: { enteredAtUtc: "desc" },
  });
}

export async function getCostSummary(designId: bigint) {
  const [design, costs] = await Promise.all([
    prisma.designConcept.findUnique({
      where: { id: designId },
      select: { estimatedCost: true, standardCost: true },
    }),
    prisma.designCost.findMany({ where: { designId } }),
  ]);

  const byType: Record<string, number> = {};
  let totalDevCost = 0;

  for (const cost of costs) {
    const amount = Number(cost.amount);
    byType[cost.costType] = (byType[cost.costType] ?? 0) + amount;
    totalDevCost += amount;
  }

  const estimated = design?.estimatedCost != null ? Number(design.estimatedCost) : null;
  const standard = design?.standardCost != null ? Number(design.standardCost) : null;
  const baseline = estimated ?? standard;
  const marginAmount = baseline != null ? baseline - totalDevCost : null;
  const marginPercent =
    baseline != null && baseline > 0 && marginAmount != null
      ? (marginAmount / baseline) * 100
      : null;

  return {
    totalDevCost,
    byType,
    entryCount: costs.length,
    hasCosting: costs.some((c) => Number(c.amount) > 0),
    estimatedCost: estimated,
    standardCost: standard,
    marginAmount,
    marginPercent,
  };
}

export async function addCostEntry(
  designId: bigint,
  input: { costType: CostType; description?: string; amount: number },
  enteredById: number,
  correlationId: string,
) {
  if (!isValidCostType(input.costType)) {
    throw new ApiError("Invalid cost type", 400);
  }
  if (input.amount <= 0) {
    throw new ApiError("Cost amount must be greater than zero", 422);
  }

  const design = await prisma.designConcept.findUnique({ where: { id: designId } });
  if (!design) throw new ApiError("Design not found", 404);

  return prisma.$transaction(async (tx) => {
    const cost = await tx.designCost.create({
      data: {
        designId,
        costType: input.costType,
        description: input.description,
        amount: input.amount,
        enteredById,
      },
      include: {
        enteredBy: { select: { id: true, name: true, employeeCode: true } },
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignCost",
      entityId: cost.id.toString(),
      action: "CREATE",
      userId: enteredById,
      correlationId,
      after: cost,
    });

    return cost;
  });
}

export async function designHasCosting(
  designId: bigint,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  const entry = await db.designCost.findFirst({
    where: { designId, amount: { gt: 0 } },
    select: { id: true },
  });
  return entry != null;
}

export async function updateDesignCostBaselines(
  designId: bigint,
  input: { estimatedCost?: number | null; standardCost?: number | null },
  userId: number,
  correlationId: string,
) {
  const existing = await prisma.designConcept.findUnique({ where: { id: designId } });
  if (!existing) throw new ApiError("Design not found", 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.designConcept.update({
      where: { id: designId },
      data: {
        ...(input.estimatedCost !== undefined ? { estimatedCost: input.estimatedCost } : {}),
        ...(input.standardCost !== undefined ? { standardCost: input.standardCost } : {}),
        version: { increment: 1 },
      },
    });
    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "COST_BASELINE_UPDATE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });
    return updated;
  });
}