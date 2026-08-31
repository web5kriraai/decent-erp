import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";

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
  const costs = await prisma.designCost.findMany({ where: { designId } });
  const byType: Record<string, number> = {};
  let totalDevCost = 0;

  for (const cost of costs) {
    const amount = Number(cost.amount);
    byType[cost.costType] = (byType[cost.costType] ?? 0) + amount;
    totalDevCost += amount;
  }

  return {
    totalDevCost,
    byType,
    entryCount: costs.length,
    hasCosting: costs.length > 0,
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

export async function designHasCosting(designId: bigint) {
  const count = await prisma.designCost.count({ where: { designId } });
  return count > 0;
}
