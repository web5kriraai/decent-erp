import type { DesignStatus, Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import { assertSameCompany } from "@/lib/tenant";
import { deleteObject } from "@/lib/storage";

const DELETABLE_STATUSES = new Set<DesignStatus>(["DRAFT", "ACTIVE"]);
const IDLE_TASK_STATUSES = new Set<TaskStatus>([
  "PENDING",
  "ASSIGNED",
  "CANCELLED",
  "SKIPPED",
]);

const STATUS_BLOCK_MESSAGE: Record<string, string> = {
  ON_HOLD: "This design is on hold.",
  APPROVAL_PENDING: "This design is awaiting approval.",
  APPROVED: "This design is already approved.",
  REJECTED: "This design was rejected.",
  PRODUCTION_ACCEPTED: "This design has been accepted for production.",
  PRODUCTION_RELEASED: "This design has been released to production.",
  LIVE: "This design is live.",
  CLOSED: "This design is closed.",
};

export type DesignDeleteReason = {
  code: string;
  message: string;
};

export type DesignDeleteEligibility = {
  allowed: boolean;
  reasons: DesignDeleteReason[];
  ideaRef: string;
  collectionName: string;
};

type DesignDb = Prisma.TransactionClient | typeof prisma;

function pushCount(
  reasons: DesignDeleteReason[],
  count: number,
  code: string,
  message: string,
) {
  if (count > 0) reasons.push({ code, message });
}

async function evaluateDesignDelete(db: DesignDb, designId: bigint, companyId: number) {
  const design = await db.designConcept.findUnique({
    where: { id: designId },
    select: {
      id: true,
      companyId: true,
      ideaRef: true,
      collectionName: true,
      status: true,
      tasks: { select: { id: true, status: true } },
      images: { select: { storageKey: true } },
      _count: {
        select: {
          corrections: true,
          approvals: true,
          costs: true,
          productionHandoffs: true,
          erpStages: true,
          materialLines: true,
          creativityRatings: true,
        },
      },
    },
  });
  if (!design) throw new ApiError("Design not found", 404);
  assertSameCompany(design.companyId, { companyId }, "Design");

  const reasons: DesignDeleteReason[] = [];
  if (!DELETABLE_STATUSES.has(design.status)) {
    reasons.push({
      code: "STATUS",
      message:
        STATUS_BLOCK_MESSAGE[design.status] ??
        "This design can no longer be deleted.",
    });
  }

  const started = design.tasks.some((task) => !IDLE_TASK_STATUSES.has(task.status));
  if (started) {
    reasons.push({
      code: "TASK_STARTED",
      message:
        "A task has been started, held, sent for checking, corrected, or completed.",
    });
  }

  const taskIds = design.tasks.map((task) => task.id);
  const timeCount = taskIds.length
    ? await db.taskTimeEvent.count({ where: { taskId: { in: taskIds } } })
    : 0;
  pushCount(
    reasons,
    timeCount,
    "TIME_LOGGED",
    "Time has been logged and cannot be deleted.",
  );
  pushCount(reasons, design._count.corrections, "CORRECTION", "A correction exists on this design.");
  pushCount(reasons, design._count.approvals, "APPROVAL", "An approval exists on this design.");
  pushCount(reasons, design._count.costs, "COST", "A cost entry exists on this design.");
  pushCount(
    reasons,
    design._count.productionHandoffs + design._count.erpStages + design._count.materialLines,
    "PRODUCTION",
    "Production, ERP, or material work exists on this design.",
  );
  pushCount(
    reasons,
    design._count.creativityRatings,
    "RATING",
    "A creativity rating exists on this design.",
  );

  const artifactKeys = taskIds.length
    ? await db.taskArtifact.findMany({
        where: { taskId: { in: taskIds }, storageKey: { not: null } },
        select: { storageKey: true },
      })
    : [];

  return {
    design,
    taskIds,
    reasons,
    storageKeys: [
      ...design.images.map((image) => image.storageKey),
      ...artifactKeys.map((row) => row.storageKey).filter((key): key is string => !!key),
    ],
  };
}

export async function getDesignDeleteEligibility(
  designId: bigint,
  companyId: number,
): Promise<DesignDeleteEligibility> {
  const { design, reasons } = await evaluateDesignDelete(prisma, designId, companyId);
  return {
    allowed: reasons.length === 0,
    reasons,
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
  };
}

async function deleteDesignChildren(
  tx: Prisma.TransactionClient,
  designId: bigint,
  taskIds: bigint[],
) {
  if (taskIds.length) {
    await tx.taskChecklistResult.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.taskArtifact.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.taskTimeEvent.deleteMany({ where: { taskId: { in: taskIds } } });
    await tx.taskTimerIdempotency.deleteMany({ where: { taskId: { in: taskIds } } });
  }

  await tx.designCorrection.deleteMany({ where: { designId } });
  await tx.designApproval.deleteMany({ where: { designId } });
  await tx.designCost.deleteMany({ where: { designId } });
  await tx.designImage.deleteMany({ where: { designId } });
  await tx.designComponent.deleteMany({ where: { designId } });
  await tx.designCreativityRating.deleteMany({ where: { designId } });
  await tx.productionHandoff.deleteMany({ where: { designId } });
  await tx.designSuccessMetric.deleteMany({ where: { designId } });
  await tx.erpStageRecord.deleteMany({ where: { designId } });
  await tx.designMaterialLine.deleteMany({ where: { designId } });
  await tx.designBomLine.updateMany({
    where: { designId },
    data: { parentLineId: null },
  });
  await tx.designBomLine.deleteMany({ where: { designId } });

  const processes = await tx.designProcess.findMany({
    where: { designId },
    select: { id: true },
  });
  if (processes.length) {
    await tx.designSubProcess.deleteMany({
      where: { designProcessId: { in: processes.map((row) => row.id) } },
    });
  }
  await tx.designProcess.deleteMany({ where: { designId } });
  await tx.designTask.deleteMany({ where: { designId } });
  await tx.designConcept.delete({ where: { id: designId } });
}

export async function deleteDesign(
  designId: bigint,
  companyId: number,
  userId: number,
  correlationId: string,
) {
  const storageKeys = await prisma.$transaction(async (tx) => {
    const evaluated = await evaluateDesignDelete(tx, designId, companyId);
    if (evaluated.reasons.length > 0) {
      throw new ApiError(
        "This design cannot be deleted.",
        409,
        { reasons: evaluated.reasons },
        "DESIGN_DELETE_BLOCKED",
      );
    }

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "DELETE",
      userId,
      correlationId,
      before: {
        ideaRef: evaluated.design.ideaRef,
        collectionName: evaluated.design.collectionName,
        status: evaluated.design.status,
        taskCount: evaluated.taskIds.length,
      },
    });

    await deleteDesignChildren(tx, designId, evaluated.taskIds);
    return evaluated.storageKeys;
  });

  for (const key of storageKeys) {
    try {
      await deleteObject(key);
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "warn",
          msg: "Design file delete skipped",
          designId: designId.toString(),
          key,
          error: String(error),
        }),
      );
    }
  }

  return { deleted: true };
}
