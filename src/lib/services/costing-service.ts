import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";
import {
  COST_ENTRY_TYPES,
  type CostType,
} from "@/lib/services/costing-end-utils";

export const COST_TYPES = COST_ENTRY_TYPES;
export type { CostType };

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

/** Active timer hours across a design's tasks (TaskTimeEvent), for salary costing. */
export async function getDesignSalaryHoursBreakdown(designId: bigint) {
  const { computeActiveSeconds } = await import("@/lib/services/time-calculation");

  const tasks = await prisma.designTask.findMany({
    where: { designId },
    select: {
      id: true,
      assignedEmployeeId: true,
      assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
      subProcess: { select: { code: true, name: true } },
      timeEvents: {
        orderBy: { eventTimeUtc: "asc" },
        select: {
          eventType: true,
          eventTimeUtc: true,
          employeeId: true,
          holdReason: { select: { code: true, excludeFromActiveTime: true } },
        },
      },
    },
  });

  let totalActiveSeconds = 0;
  const byEmployee = new Map<
    number,
    { employeeId: number; name: string; code: string; activeSeconds: number }
  >();

  for (const task of tasks) {
    const seconds = computeActiveSeconds(
      task.timeEvents.map((e) => ({
        eventType: e.eventType,
        eventTimeUtc: e.eventTimeUtc,
        holdReason: e.holdReason,
      })),
    );
    if (seconds <= 0) continue;
    totalActiveSeconds += seconds;
    const empId = task.assignedEmployeeId;
    if (empId == null || !task.assignedEmployee) continue;
    const cur = byEmployee.get(empId) ?? {
      employeeId: empId,
      name: task.assignedEmployee.name,
      code: task.assignedEmployee.employeeCode,
      activeSeconds: 0,
    };
    cur.activeSeconds += seconds;
    byEmployee.set(empId, cur);
  }

  const totalHours = Math.round((totalActiveSeconds / 3600) * 100) / 100;

  return {
    totalActiveSeconds,
    totalHours,
    byEmployee: [...byEmployee.values()].map((row) => ({
      ...row,
      hours: Math.round((row.activeSeconds / 3600) * 100) / 100,
    })),
  };
}

export async function getCostSummary(designId: bigint) {
  const [design, costs, salaryHours] = await Promise.all([
    prisma.designConcept.findUnique({
      where: { id: designId },
      select: { estimatedCost: true, standardCost: true, expectedMrp: true },
    }),
    prisma.designCost.findMany({ where: { designId } }),
    getDesignSalaryHoursBreakdown(designId),
  ]);

  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalDevCost = 0;

  for (const cost of costs) {
    const amount = Number(cost.amount);
    byType[cost.costType] = (byType[cost.costType] ?? 0) + amount;
    const cat = cost.costCategory ?? "OTHER";
    byCategory[cat] = (byCategory[cat] ?? 0) + amount;
    totalDevCost += amount;
  }

  const estimated = design?.estimatedCost != null ? Number(design.estimatedCost) : null;
  const standard = design?.standardCost != null ? Number(design.standardCost) : null;
  const expectedMrp = design?.expectedMrp != null ? Number(design.expectedMrp) : null;
  const baseline = estimated ?? standard;
  const marginAmount = baseline != null ? baseline - totalDevCost : null;
  const marginPercent =
    baseline != null && baseline > 0 && marginAmount != null
      ? (marginAmount / baseline) * 100
      : null;
  const mrpMarginAmount = expectedMrp != null ? expectedMrp - totalDevCost : null;
  const mrpMarginPercent =
    expectedMrp != null && expectedMrp > 0 && mrpMarginAmount != null
      ? (mrpMarginAmount / expectedMrp) * 100
      : null;

  return {
    totalDevCost,
    byType,
    byCategory,
    entryCount: costs.length,
    hasCosting: costs.some((c) => Number(c.amount) > 0),
    estimatedCost: estimated,
    standardCost: standard,
    expectedMrp,
    marginAmount,
    marginPercent,
    mrpMarginAmount,
    mrpMarginPercent,
    salaryHours,
  };
}

export type CostEntryCreateInput = {
  costType: CostType;
  costCategory?: "FABRIC" | "EMBROIDERY" | "STITCHING" | "SALARY" | "OTHER" | null;
  description?: string;
  amount: number;
};

/** Create a DesignCost row inside an existing transaction (shared by Finance API and task end). */
export async function createCostEntryInTx(
  tx: Prisma.TransactionClient,
  designId: bigint,
  input: CostEntryCreateInput,
  enteredById: number,
  correlationId: string,
  options?: { skipDesignCheck?: boolean },
) {
  if (!isValidCostType(input.costType)) {
    throw new ApiError("Invalid cost type", 400);
  }
  if (input.amount <= 0) {
    throw new ApiError("Cost amount must be greater than zero", 422);
  }

  if (!options?.skipDesignCheck) {
    const design = await tx.designConcept.findUnique({
      where: { id: designId },
      select: { id: true },
    });
    if (!design) throw new ApiError("Design not found", 404);
  }

  const cost = await tx.designCost.create({
    data: {
      designId,
      costType: input.costType,
      costCategory: input.costCategory ?? null,
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
}

export async function addCostEntry(
  designId: bigint,
  input: CostEntryCreateInput,
  enteredById: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    return createCostEntryInTx(tx, designId, input, enteredById, correlationId);
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
