import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { designHasCosting } from "@/lib/services/costing-service";
import {
  collectPresentStageGaps,
  isDesignHeadFinalGateSatisfied,
  isDesignLifecycleReadyForRelease,
  shouldRequireManagementApprovalLevels,
  type ReadinessTaskSnapshot,
} from "@/lib/services/production-release-readiness-utils";
import {
  designRequiresCosting,
  evaluateTransition,
} from "@/lib/workflow/transition-policies";

export { collectPresentStageGaps } from "@/lib/services/production-release-readiness-utils";
export type { ReadinessTaskSnapshot } from "@/lib/services/production-release-readiness-utils";
export {
  isDesignHeadFinalGateSatisfied,
  isDesignLifecycleReadyForRelease,
  shouldRequireManagementApprovalLevels,
} from "@/lib/services/production-release-readiness-utils";

type Tx = Prisma.TransactionClient;

export type ProductionReleaseReadiness = {
  ok: boolean;
  missing: string[];
};

/**
 * Server-authoritative checklist before production release.
 * Design-side stages and data gates are required only when present on the design.
 * Spec Stage 9 — full Management ApprovalLevel chain is always required before APPROVED.
 */
export async function validateProductionReleaseReadiness(
  designId: bigint,
  tx?: Tx,
): Promise<ProductionReleaseReadiness> {
  const db = tx ?? prisma;
  const missing: string[] = [];

  const design = await db.designConcept.findUnique({
    where: { id: designId },
    select: { status: true },
  });
  if (!design) {
    return { ok: false, missing: ["Design record"] };
  }

  const designTasks = await db.designTask.findMany({
    where: { designId },
    include: {
      subProcess: {
        select: {
          name: true,
          code: true,
          isFileRequired: true,
          isApproval: true,
          capabilities: true,
        },
      },
    },
  });

  const hasCosting = await designHasCosting(designId, db);
  const costingEval = evaluateTransition({
    transition: "design.production_release",
    tasks: designTasks,
    hasCosting,
  });
  if (!costingEval.ok && costingEval.meta.requiresCosting) {
    missing.push("Development costing");
  }

  const approvalRowCount = await db.designApproval.count({ where: { designId } });
  const requireManagementLevels = shouldRequireManagementApprovalLevels({
    designStatus: design.status,
    hasAnyDesignApproval: approvalRowCount > 0,
  });

  // Spec Stage 9 — all active ApprovalLevels must pass before release.
  if (requireManagementLevels) {
    const levels = await db.approvalLevel.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
    });
    if (levels.length === 0) {
      missing.push("Management approval levels (configure Approval Levels)");
    } else {
      const approvals = await db.designApproval.findMany({
        where: { designId, decision: { in: ["APPROVED", "SKIPPED"] } },
      });
      const passedIds = new Set(approvals.map((a) => a.approvalLevelId));
      for (const level of levels) {
        if (!passedIds.has(level.id)) {
          missing.push(`${level.name} approval`);
        }
      }
    }
  }

  const tasksByCode: Record<string, ReadinessTaskSnapshot | undefined> = {};
  for (const task of designTasks) {
    const code = task.subProcess.code;
    let hasFile = true;
    if (task.subProcess.isFileRequired) {
      const files = await db.taskArtifact.count({
        where: { taskId: task.id, storageKey: { not: null } },
      });
      hasFile = files > 0;
    }
    tasksByCode[code] = {
      status: task.status,
      isFileRequired: task.subProcess.isFileRequired,
      isApproval: task.subProcess.isApproval,
      capabilities: task.subProcess.capabilities,
      name: task.subProcess.name,
      hasFile,
      code,
    };
  }

  const finalGateSatisfied = isDesignHeadFinalGateSatisfied(tasksByCode);
  if (
    !isDesignLifecycleReadyForRelease({
      designStatus: design.status,
      finalGateSatisfied,
      managementDecideStarted: requireManagementLevels,
    })
  ) {
    missing.push("Management / final approval (design must be Approved)");
  }

  missing.push(...collectPresentStageGaps(tasksByCode));

  return { ok: missing.length === 0, missing };
}

/**
 * Promote APPROVAL_PENDING → APPROVED only when the full release checklist is green
 * (including complete management decide). Never promotes ACTIVE/ON_HOLD past Stage 9.
 */
export async function healDesignApprovedForRelease(
  designId: bigint,
  tx?: Tx,
): Promise<{ healed: boolean; status: string }> {
  const db = tx ?? prisma;
  const design = await db.designConcept.findUnique({
    where: { id: designId },
    select: { status: true },
  });
  if (!design) {
    return { healed: false, status: "MISSING" };
  }
  if (
    design.status === "APPROVED" ||
    design.status === "PRODUCTION_ACCEPTED" ||
    design.status === "PRODUCTION_RELEASED" ||
    design.status === "LIVE"
  ) {
    return { healed: false, status: design.status };
  }

  // Only heal from APPROVAL_PENDING after the decide chain is complete.
  // ACTIVE/ON_HOLD must go through Design Head request sign-off first.
  if (design.status !== "APPROVAL_PENDING") {
    return { healed: false, status: design.status };
  }

  const readiness = await validateProductionReleaseReadiness(designId, db);
  if (!readiness.ok) {
    return { healed: false, status: design.status };
  }

  await db.designConcept.update({
    where: { id: designId },
    data: { status: "APPROVED" },
  });
  return { healed: true, status: "APPROVED" };
}

/** Re-export for callers that need presence check without full readiness. */
export { designRequiresCosting };
