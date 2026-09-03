import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { designHasCosting } from "@/lib/services/costing-service";
import {
  collectPresentStageGaps,
  type ReadinessTaskSnapshot,
} from "@/lib/services/production-release-readiness-utils";

export { collectPresentStageGaps } from "@/lib/services/production-release-readiness-utils";
export type { ReadinessTaskSnapshot } from "@/lib/services/production-release-readiness-utils";

type Tx = Prisma.TransactionClient;

export type ProductionReleaseReadiness = {
  ok: boolean;
  missing: string[];
};

type TaskRow = {
  id: bigint;
  status: string;
  subProcess: { name: string; code: string; isFileRequired: boolean };
};

async function taskByCode(
  tx: Tx | typeof prisma,
  designId: bigint,
  code: string,
): Promise<TaskRow | null> {
  return (tx as Tx).designTask.findFirst({
    where: { designId, subProcess: { code } },
    include: { subProcess: { select: { name: true, code: true, isFileRequired: true } } },
  });
}

/**
 * Server-authoritative checklist before production release.
 * Design-side stages are required only when present on the design (flexible patterns).
 * Production ladder stages are required when present (auto-appended on APPROVED).
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

  const hasCosting = await designHasCosting(designId, db);
  if (!hasCosting) {
    missing.push("Development costing");
  }

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

  const codes = [
    "SKETCH",
    "SKETCH_APPROVAL",
    "PUNCH",
    "PUNCH_CHECK",
    "MAT_REQ",
    "FABRIC_ISSUE",
    "MACHINE_SAMPLE",
    "SAMPLE_CHECK",
    "FINAL_APPROVAL",
    "PROD_HANDOFF",
    "PROD_INSTRUCTION",
  ] as const;

  const tasksByCode: Record<string, ReadinessTaskSnapshot | undefined> = {};
  for (const code of codes) {
    const task = await taskByCode(db, designId, code);
    if (!task) continue;
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
      hasFile,
    };
  }

  missing.push(...collectPresentStageGaps(tasksByCode));

  return { ok: missing.length === 0, missing };
}
