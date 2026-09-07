import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canRoleSeeManagementSignOff } from "@/lib/approval-hub-rbac";
import { designHasCosting } from "@/lib/services/costing-service";
import {
  collectPresentStageGaps,
  type ReadinessTaskSnapshot,
} from "@/lib/services/production-release-readiness-utils";
import {
  designRequiresCosting,
  evaluateTransition,
} from "@/lib/workflow/transition-policies";

export { collectPresentStageGaps } from "@/lib/services/production-release-readiness-utils";
export type { ReadinessTaskSnapshot } from "@/lib/services/production-release-readiness-utils";

type Tx = Prisma.TransactionClient;

export type ProductionReleaseReadiness = {
  ok: boolean;
  missing: string[];
};

/**
 * Server-authoritative checklist before production release.
 * Design-side stages and data gates are required only when present on the design.
 * Legacy management ApprovalLevel chain only when management decide UI is enabled.
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

  if (
    design.status !== "APPROVED" &&
    design.status !== "PRODUCTION_ACCEPTED" &&
    design.status !== "PRODUCTION_RELEASED"
  ) {
    missing.push("Management / final approval (design must be Approved)");
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

  // Option A: management decide chain disabled — skip per-level ApprovalLevel checklist
  // for Design Head sign-off path. Legacy chain only when product UI re-enables it.
  if (canRoleSeeManagementSignOff(null)) {
    const levels = await db.approvalLevel.findMany({
      where: { active: true },
      orderBy: { sequence: "asc" },
    });
    if (levels.length > 0) {
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

  missing.push(...collectPresentStageGaps(tasksByCode));

  return { ok: missing.length === 0, missing };
}

/** Re-export for callers that need presence check without full readiness. */
export { designRequiresCosting };
