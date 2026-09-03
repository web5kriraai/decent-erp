import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import type { CorrectionType, CorrectionStatus, Prisma } from "@prisma/client";
import { MISTAKE_CORRECTION_TYPES } from "@/lib/kpi-metrics";
import { resolveEmployeesForRoles } from "@/lib/services/assignment-service";
import {
  effectiveDependencySequence,
} from "@/lib/services/task-dependency";
import {
  buildCorrectionScopeForEmployee,
  correctionVisibleToEmployee,
  getAllowedCorrectionStatusOptions,
  isRoutedReworkSatisfied,
  normalizeCorrectionStatus,
  OPEN_CORRECTION_STATUSES,
} from "@/lib/services/correction-queue-utils";

function ratingImpactForType(type: CorrectionType): number {
  return MISTAKE_CORRECTION_TYPES.includes(type as (typeof MISTAKE_CORRECTION_TYPES)[number])
    ? -5
    : 0;
}

const REOPENABLE_ROUTE_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "CORRECTION_REQUIRED",
  "CHECKING",
  "COMPLETED",
  "RUNNING",
  "ON_HOLD",
  "SKIPPED",
] as const;

const RELOCK_LATER_STATUSES = ["ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"] as const;

const correctionInclude = {
  design: { select: { id: true, ideaRef: true, collectionName: true } },
  task: {
    select: {
      id: true,
      process: { select: { name: true, code: true } },
      subProcess: { select: { name: true, code: true } },
    },
  },
  raisedBy: { select: { id: true, name: true, employeeCode: true } },
  responsibleEmployee: { select: { id: true, name: true, employeeCode: true } },
  routeToSubProcess: { select: { id: true, code: true, name: true } },
} as const;

type Tx = Prisma.TransactionClient;

async function endOpenTimerIfNeeded(
  tx: Tx,
  task: { id: bigint; status: string; assignedEmployeeId: number | null },
  actorId: number,
  remark: string,
) {
  if (
    !["RUNNING", "ON_HOLD"].includes(task.status) ||
    task.assignedEmployeeId == null ||
    !actorId
  ) {
    return;
  }
  await tx.taskTimeEvent.create({
    data: {
      taskId: task.id,
      employeeId: task.assignedEmployeeId,
      eventType: "END",
      remark,
      eventTimeUtc: new Date(),
      createdById: actorId,
    },
  });
}

/** Re-lock later stages so Costing etc. leave the queue while rework is open. */
export async function relockLaterStagesAfterCorrection(
  tx: Tx,
  input: {
    designId: bigint;
    sourceTaskId: bigint;
    sourceSeq: number;
    routedTaskId: bigint | null;
    actorId: number;
  },
) {
  const later = await tx.designTask.findMany({
    where: {
      designId: input.designId,
      id: {
        notIn: [
          input.sourceTaskId,
          ...(input.routedTaskId != null ? [input.routedTaskId] : []),
        ],
      },
      status: { in: [...RELOCK_LATER_STATUSES] },
    },
    select: {
      id: true,
      status: true,
      assignedEmployeeId: true,
      dependencySequence: true,
      sequence: true,
    },
  });

  for (const row of later) {
    if (effectiveDependencySequence(row) <= input.sourceSeq) continue;

    await endOpenTimerIfNeeded(
      tx,
      row,
      input.actorId,
      "Correction raised — later stage re-locked",
    );

    await tx.designTask.update({
      where: { id: row.id },
      data: {
        status: "PENDING",
        completedAt: null,
        version: { increment: 1 },
      },
    });
  }
}

export async function createOrReopenRoutedTask(
  tx: Tx,
  input: {
    designId: bigint;
    routeToSubProcessId: number;
    responsibleEmployeeId?: number | null;
    sourceTaskId: bigint;
    actorId?: number;
  },
) {
  const subProcess = await tx.designSubProcessMaster.findUnique({
    where: { id: input.routeToSubProcessId },
  });
  if (!subProcess || !subProcess.active) {
    throw new ApiError("Route-to sub-process not found", 422);
  }

  const existing = await tx.designTask.findFirst({
    where: {
      designId: input.designId,
      subProcessId: input.routeToSubProcessId,
      status: { in: [...REOPENABLE_ROUTE_STATUSES] },
    },
    orderBy: { id: "desc" },
  });

  let assigneeId = input.responsibleEmployeeId ?? existing?.assignedEmployeeId ?? null;
  if (!assigneeId && subProcess.defaultRoleId) {
    const map = await resolveEmployeesForRoles([subProcess.defaultRoleId]);
    assigneeId = map.get(subProcess.defaultRoleId) ?? null;
  }

  // Rework of an already-released stage: reopen as CORRECTION_REQUIRED (Rework column)
  if (
    existing &&
    (REOPENABLE_ROUTE_STATUSES as readonly string[]).includes(existing.status)
  ) {
    await endOpenTimerIfNeeded(
      tx,
      existing,
      input.actorId ?? assigneeId ?? existing.assignedEmployeeId ?? 0,
      "Correction routed — rework required",
    );

    return tx.designTask.update({
      where: { id: existing.id },
      data: {
        status: "CORRECTION_REQUIRED",
        assignedEmployeeId: assigneeId ?? existing.assignedEmployeeId,
        completedAt: null,
        outputRemark: null,
        skipReason: null,
        skippedAt: null,
        skippedById: null,
        version: { increment: 1 },
      },
    });
  }

  const source = await tx.designTask.findUnique({ where: { id: input.sourceTaskId } });
  const maxSeq = await tx.designTask.aggregate({
    where: { designId: input.designId },
    _max: { sequence: true },
  });
  const sequence = (maxSeq._max.sequence ?? 0) + 1;
  const dependencySequence = (source?.dependencySequence ?? source?.sequence ?? 0) + 1;

  // New routed rework lands in Rework column when an assignee is known
  const status = assigneeId ? "CORRECTION_REQUIRED" : "PENDING";

  return tx.designTask.create({
    data: {
      designId: input.designId,
      processId: subProcess.processId,
      subProcessId: subProcess.id,
      assignedEmployeeId: assigneeId,
      assignedRoleId: subProcess.defaultRoleId ?? source?.assignedRoleId ?? 1,
      status,
      priority: source?.priority ?? "HIGH",
      expectedMinutes: source?.expectedMinutes ?? 120,
      sequence,
      dependencySequence,
    },
  });
}

export async function countOpenCorrectionsForEmployee(employeeId: number) {
  return prisma.designCorrection.count({
    where: {
      status: { in: [...OPEN_CORRECTION_STATUSES] },
      ...buildCorrectionScopeForEmployee(employeeId),
    },
  });
}

export async function listCorrections(filters: {
  employeeId: number;
  designId?: bigint;
  status?: CorrectionStatus;
}) {
  return prisma.designCorrection.findMany({
    where: {
      AND: [
        buildCorrectionScopeForEmployee(filters.employeeId),
        ...(filters.designId ? [{ designId: filters.designId }] : []),
        ...(filters.status ? [{ status: filters.status }] : []),
      ],
    },
    include: correctionInclude,
    orderBy: { createdAtUtc: "desc" },
  });
}

export type RaiseCorrectionInput = {
  designId: bigint;
  taskId: bigint;
  correctionType: CorrectionType;
  responsibleEmployeeId?: number | null;
  routeToSubProcessId?: number | null;
  rootCause?: string;
  extraMinutes?: number;
  extraCost?: number;
  beforeImageId?: bigint;
  afterImageId?: bigint;
};

export async function raiseCorrectionInTransaction(
  tx: Tx,
  input: RaiseCorrectionInput,
  raisedById: number,
  correlationId: string,
) {
  if (input.correctionType === "MISTAKE" && !input.responsibleEmployeeId) {
    throw new ApiError("Responsible employee is required for mistake corrections", 422);
  }

  const task = await tx.designTask.findUnique({ where: { id: input.taskId } });
  if (!task) throw new ApiError("Task not found", 404);
  if (task.designId !== input.designId) {
    throw new ApiError("Task does not belong to design", 422);
  }

  let routedTaskId: bigint | null = null;
  if (input.routeToSubProcessId) {
    const routed = await createOrReopenRoutedTask(tx, {
      designId: input.designId,
      routeToSubProcessId: input.routeToSubProcessId,
      responsibleEmployeeId: input.responsibleEmployeeId,
      sourceTaskId: input.taskId,
      actorId: raisedById,
    });
    routedTaskId = routed.id;
  }

  const correction = await tx.designCorrection.create({
    data: {
      designId: input.designId,
      taskId: input.taskId,
      correctionType: input.correctionType,
      responsibleEmployeeId: input.responsibleEmployeeId ?? null,
      routeToSubProcessId: input.routeToSubProcessId ?? null,
      routedTaskId,
      raisedById,
      rootCause: input.rootCause,
      extraMinutes: input.extraMinutes,
      extraCost: input.extraCost,
      beforeImageId: input.beforeImageId,
      afterImageId: input.afterImageId,
      status: "OPEN",
      ratingImpact: ratingImpactForType(input.correctionType),
    },
  });

  await tx.designTask.update({
    where: { id: input.taskId },
    data: { status: "CORRECTION_REQUIRED", version: { increment: 1 } },
  });

  await relockLaterStagesAfterCorrection(tx, {
    designId: input.designId,
    sourceTaskId: input.taskId,
    sourceSeq: effectiveDependencySequence(task),
    routedTaskId,
    actorId: raisedById,
  });

  const sourceTask = await tx.designTask.findUnique({
    where: { id: input.taskId },
    include: { subProcess: { select: { code: true } } },
  });
  const qualityCodes = new Set(["SKETCH", "PUNCH", "MACHINE_SAMPLE", "SAMPLE_CHECK", "PUNCH_CHECK"]);
  if (sourceTask && qualityCodes.has(sourceTask.subProcess.code)) {
    await tx.designImage.updateMany({
      where: { designId: input.designId, isPrimary: false },
      data: {
        reviewStatus: "REJECTED",
        reviewNote: input.rootCause ?? "Returned for correction",
      },
    });
  }

  await writeAuditLog(tx, {
    entityType: "DesignCorrection",
    entityId: correction.id.toString(),
    action: "CREATE",
    userId: raisedById,
    correlationId,
    after: correction,
  });

  return correction;
}

export async function createCorrection(
  input: RaiseCorrectionInput,
  raisedById: number,
  correlationId: string,
) {
  if (input.correctionType === "MISTAKE" && !input.responsibleEmployeeId) {
    throw new ApiError("Responsible employee is required for mistake corrections", 422);
  }

  return prisma.$transaction(async (tx) => {
    const correction = await raiseCorrectionInTransaction(tx, input, raisedById, correlationId);
    return tx.designCorrection.findUniqueOrThrow({
      where: { id: correction.id },
      include: correctionInclude,
    });
  }).then(async (correction) => {
    await enqueueOutboxAndNotify(
      "CORRECTION_RAISED",
      {
        correctionId: correction.id.toString(),
        designId: correction.designId.toString(),
        taskId: correction.taskId.toString(),
        responsibleEmployeeId: correction.responsibleEmployeeId,
      },
      correlationId,
    );
    return correction;
  });
}

export async function updateCorrection(
  id: bigint,
  input: {
    status?: CorrectionStatus;
    rootCause?: string;
    extraMinutes?: number;
    extraCost?: number;
  },
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.designCorrection.findUnique({
      where: { id },
      include: {
        task: { select: { assignedEmployeeId: true } },
      },
    });
    if (!existing) throw new ApiError("Correction not found", 404);
    if (!correctionVisibleToEmployee(existing, userId)) {
      throw new ApiError("You do not have access to this correction", 403);
    }

    if (input.status && input.status !== existing.status) {
      const allowed = getAllowedCorrectionStatusOptions(existing.status);
      const nextNormalized = normalizeCorrectionStatus(input.status);
      if (!allowed.includes(nextNormalized as (typeof allowed)[number])) {
        throw new ApiError(
          `Cannot change correction status from ${normalizeCorrectionStatus(existing.status)} to ${nextNormalized}.`,
          422,
        );
      }
    }

    const updated = await tx.designCorrection.update({
      where: { id },
      data: input,
      include: correctionInclude,
    });

    if (input.status === "DONE" && existing.status !== "DONE") {
      const sourceTask = await tx.designTask.findUnique({
        where: { id: existing.taskId },
        include: { subProcess: { select: { code: true, isApproval: true } } },
      });

      if (existing.routedTaskId) {
        const routed = await tx.designTask.findUnique({
          where: { id: existing.routedTaskId },
        });
        if (routed && !isRoutedReworkSatisfied(routed.status)) {
          throw new ApiError(
            "Rework is still open. Kumar (or the routed owner) must complete the rework stage before this correction can be marked Done.",
            422,
          );
        }
      }

      if (sourceTask && sourceTask.status === "CORRECTION_REQUIRED") {
        // Routed quality corrections: reopen the check/source for another review.
        // Never COMPLETE the gate or unlock Costing from the Corrections dropdown.
        await tx.designTask.update({
          where: { id: sourceTask.id },
          data: {
            status: "ASSIGNED",
            completedAt: null,
            version: { increment: 1 },
          },
        });

        await tx.designConcept.update({
          where: { id: sourceTask.designId },
          data: {
            currentStage: sourceTask.subProcess.code,
            status: "ACTIVE",
          },
        });

        if (sourceTask.assignedEmployeeId != null) {
          await enqueueOutboxAndNotify(
            "TASK_ASSIGNED",
            {
              taskId: sourceTask.id.toString(),
              employeeId: sourceTask.assignedEmployeeId,
              isStageApproval: sourceTask.subProcess.isApproval === true,
            },
            correlationId,
          );
        }
      }
    }

    if (input.status === "REJECTED" && existing.status !== "REJECTED") {
      const sourceTask = await tx.designTask.findUnique({ where: { id: existing.taskId } });
      if (sourceTask && sourceTask.status === "CORRECTION_REQUIRED") {
        await tx.designTask.update({
          where: { id: sourceTask.id },
          data: { status: "ASSIGNED", version: { increment: 1 } },
        });
      }
    }

    await writeAuditLog(tx, {
      entityType: "DesignCorrection",
      entityId: id.toString(),
      action: "UPDATE",
      userId,
      correlationId,
      before: existing,
      after: updated,
    });

    return updated;
  });
}

/** Mark open corrections for a design/task as DONE (e.g. after Sample Approve). */
export async function closeOpenCorrectionsForTask(
  tx: Tx,
  input: {
    designId: bigint;
    taskId?: bigint;
    routedTaskId?: bigint;
  },
) {
  const where: Prisma.DesignCorrectionWhereInput = {
    designId: input.designId,
    status: { in: [...OPEN_CORRECTION_STATUSES] },
    OR: [
      ...(input.taskId != null ? [{ taskId: input.taskId }] : []),
      ...(input.routedTaskId != null ? [{ routedTaskId: input.routedTaskId }] : []),
    ],
  };

  if (!input.taskId && !input.routedTaskId) {
    return { count: 0 };
  }

  return tx.designCorrection.updateMany({
    where,
    data: { status: "DONE" },
  });
}

/** After routed rework (Machine Sample) finishes, reopen the source check for another pass. */
export async function reopenSourceCheckAfterRoutedRework(
  tx: Tx,
  input: {
    designId: bigint;
    routedTaskId: bigint;
    correlationId: string;
  },
) {
  const openCorrection = await tx.designCorrection.findFirst({
    where: {
      designId: input.designId,
      routedTaskId: input.routedTaskId,
      status: { in: [...OPEN_CORRECTION_STATUSES] },
    },
    orderBy: { createdAtUtc: "desc" },
  });
  if (!openCorrection) return null;

  const sourceTask = await tx.designTask.findUnique({
    where: { id: openCorrection.taskId },
    include: { subProcess: { select: { code: true, isApproval: true } } },
  });
  if (!sourceTask) return null;

  if (
    !["CORRECTION_REQUIRED", "COMPLETED", "CHECKING", "PENDING"].includes(sourceTask.status)
  ) {
    // Already assigned / running for re-check
    if (openCorrection.status === "OPEN" || openCorrection.status === "ASSIGNED") {
      await tx.designCorrection.update({
        where: { id: openCorrection.id },
        data: { status: "IN_PROGRESS" },
      });
    }
    return sourceTask;
  }

  let assigneeId = sourceTask.assignedEmployeeId;
  if (!assigneeId && sourceTask.assignedRoleId) {
    const { resolveEmployeeForRole } = await import("@/lib/services/assignment-service");
    assigneeId = await resolveEmployeeForRole(sourceTask.assignedRoleId);
  }

  await tx.designTask.update({
    where: { id: sourceTask.id },
    data: {
      status: "ASSIGNED",
      assignedEmployeeId: assigneeId,
      completedAt: null,
      outputRemark: null,
      version: { increment: 1 },
    },
  });

  await tx.designConcept.update({
    where: { id: input.designId },
    data: { currentStage: sourceTask.subProcess.code, status: "ACTIVE" },
  });

  await tx.designCorrection.update({
    where: { id: openCorrection.id },
    data: { status: "IN_PROGRESS" },
  });

  if (assigneeId != null) {
    await enqueueOutboxAndNotify(
      "TASK_ASSIGNED",
      {
        taskId: sourceTask.id.toString(),
        employeeId: assigneeId,
        isStageApproval: sourceTask.subProcess.isApproval === true,
      },
      input.correlationId,
    );
  }

  return sourceTask;
}
