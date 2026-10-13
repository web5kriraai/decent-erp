import type { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { ApiError } from "@/lib/api-utils";
import { assertSameCompany } from "@/lib/tenant";
import { deleteObject, isDesignStorageKey } from "@/lib/storage";
import {
  canActorDeleteDesign,
  isDesignStatusDeletable,
  type DesignDeleteActor,
} from "@/lib/design-delete-rules";

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

export type { DesignDeleteActor };

const NOT_OWNER_MESSAGE =
  "Only the design head, the person who created this design, or an admin can delete it.";

function pushCount(
  reasons: DesignDeleteReason[],
  count: number,
  code: string,
  message: string,
) {
  if (count > 0) reasons.push({ code, message });
}

async function evaluateDesignDelete(
  db: DesignDb,
  designId: bigint,
  companyId: number,
  actor: DesignDeleteActor,
) {
  const design = await db.designConcept.findUnique({
    where: { id: designId },
    select: {
      id: true,
      companyId: true,
      ideaRef: true,
      collectionName: true,
      status: true,
      createdById: true,
      designHeadEmployeeId: true,
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
  if (!canActorDeleteDesign(actor, design)) {
    reasons.push({ code: "NOT_OWNER", message: NOT_OWNER_MESSAGE });
  }
  if (!isDesignStatusDeletable(design.status)) {
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
      ...new Set([
        // Image keys are server-generated and always belong to this design.
        ...design.images.map((image) => image.storageKey),
        // Artifact keys are client-supplied; only remove files stored under this design.
        ...artifactKeys
          .map((row) => row.storageKey)
          .filter((key): key is string => !!key && isDesignStorageKey(designId, key)),
      ]),
    ],
  };
}

export async function getDesignDeleteEligibility(
  designId: bigint,
  companyId: number,
  actor: DesignDeleteActor,
): Promise<DesignDeleteEligibility> {
  const { design, reasons } = await evaluateDesignDelete(prisma, designId, companyId, actor);
  return {
    allowed: reasons.length === 0,
    reasons,
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
  };
}

/**
 * Lock the design and its task rows before checking eligibility. Timer starts,
 * artifact uploads and status changes either update a task row or insert a child
 * row (FK KEY SHARE lock), so they wait for this transaction instead of slipping
 * in between the check and the delete. Once the design row is locked no new task
 * can be inserted for it.
 *
 * The design row query also scopes by company, so a caller can never lock another
 * company's rows.
 */
async function lockDesignForDelete(
  tx: Prisma.TransactionClient,
  designId: bigint,
  companyId: number,
) {
  const locked = await tx.$queryRaw<Array<{ design_id: bigint }>>`
    SELECT design_id FROM design_concepts
    WHERE design_id = ${designId} AND company_id = ${companyId}
    FOR UPDATE`;
  if (locked.length === 0) throw new ApiError("Design not found", 404);
  await tx.$queryRaw`SELECT task_id FROM design_tasks WHERE design_id = ${designId} FOR UPDATE`;
}

const DELETE_MAX_ATTEMPTS = 3;

/**
 * Other workflows lock design and task rows in both orders (updateDesign: design →
 * tasks; endTask: task → design), so a concurrent edit can deadlock with the delete.
 * Postgres aborts one side; retry ours instead of returning a 500.
 */
function isDeadlock(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, meta, message } = error as {
    code?: string;
    meta?: { code?: string };
    message?: string;
  };
  return (
    code === "P2034" ||
    meta?.code === "40P01" ||
    (typeof message === "string" && message.includes("40P01"))
  );
}

export async function deleteDesign(
  designId: bigint,
  companyId: number,
  actor: DesignDeleteActor,
  correlationId: string,
) {
  const runDelete = () => prisma.$transaction(async (tx) => {
    await lockDesignForDelete(tx, designId, companyId);
    const evaluated = await evaluateDesignDelete(tx, designId, companyId, actor);
    if (evaluated.reasons.some((reason) => reason.code === "NOT_OWNER")) {
      throw new ApiError(NOT_OWNER_MESSAGE, 403, undefined, "DESIGN_DELETE_FORBIDDEN");
    }
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
      userId: actor.employeeId,
      correlationId,
      before: {
        ideaRef: evaluated.design.ideaRef,
        collectionName: evaluated.design.collectionName,
        status: evaluated.design.status,
        taskCount: evaluated.taskIds.length,
      },
    });

    // Every child table cascades from DesignConcept / DesignTask (FK ON DELETE CASCADE).
    await tx.designConcept.delete({ where: { id: designId } });
    return evaluated.storageKeys;
  });

  let storageKeys: string[] | undefined;
  for (let attempt = 1; !storageKeys; attempt++) {
    try {
      storageKeys = await runDelete();
    } catch (error) {
      if (attempt >= DELETE_MAX_ATTEMPTS || !isDeadlock(error)) throw error;
    }
  }

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
