import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";

export type AssignmentRuleCriteria = {
  productTypeId?: number;
  skillId?: number;
  preferredEmployeeId?: number;
  subProcessCode?: string;
};

export async function listAssignmentRules(companyId: number) {
  return prisma.assignmentRule.findMany({
    where: { companyId },
    orderBy: [{ active: "desc" }, { priority: "asc" }, { id: "asc" }],
  });
}

export async function createAssignmentRule(
  companyId: number,
  input: {
    name: string;
    priority?: number;
    active?: boolean;
    strategy?: string;
    criteriaJson?: AssignmentRuleCriteria;
  },
) {
  return prisma.assignmentRule.create({
    data: {
      companyId,
      name: input.name,
      priority: input.priority ?? 100,
      active: input.active ?? true,
      strategy: input.strategy ?? "WORKLOAD_SKILL",
      criteriaJson: (input.criteriaJson ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function updateAssignmentRule(
  id: number,
  companyId: number,
  input: Partial<{
    name: string;
    priority: number;
    active: boolean;
    strategy: string;
    criteriaJson: AssignmentRuleCriteria;
  }>,
) {
  const existing = await prisma.assignmentRule.findFirst({
    where: { id, companyId },
  });
  if (!existing) throw new ApiError("Assignment rule not found", 404);

  return prisma.assignmentRule.update({
    where: { id },
    data: {
      ...input,
      ...(input.criteriaJson
        ? { criteriaJson: input.criteriaJson as Prisma.InputJsonValue }
        : {}),
    },
  });
}

/** First matching active rule for company (lower priority number wins). */
export async function findActiveAssignmentRule(
  companyId: number,
  context: { productTypeId?: number; subProcessCode?: string },
) {
  const rules = await prisma.assignmentRule.findMany({
    where: { companyId, active: true },
    orderBy: [{ priority: "asc" }, { id: "asc" }],
  });

  for (const rule of rules) {
    const criteria = (rule.criteriaJson ?? {}) as AssignmentRuleCriteria;
    if (criteria.productTypeId != null && criteria.productTypeId !== context.productTypeId) {
      continue;
    }
    if (
      criteria.subProcessCode != null &&
      criteria.subProcessCode !== context.subProcessCode
    ) {
      continue;
    }
    return rule;
  }
  return null;
}
