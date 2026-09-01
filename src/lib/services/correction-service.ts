import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import type { CorrectionType, CorrectionStatus, Prisma } from "@prisma/client";
import { MISTAKE_CORRECTION_TYPES } from "@/lib/kpi-metrics";
import { resolveEmployeesForRoles } from "@/lib/services/assignment-service";
import {
  effectiveDependencySequence,
  initialStatusForCreate,
  isTaskReady,
} from "@/lib/services/task-dependency";
import { unlockNextDependentTasks } from "@/lib/services/task-dependency-unlock";

function ratingImpactForType(type: CorrectionType): number {
  return MISTAKE_CORRECTION_TYPES.includes(type as (typeof MISTAKE_CORRECTION_TYPES)[number])
    ? -5
    : 0;
}

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

export async function createOrReopenRoutedTask(
  tx: Tx,
  input: {
    designId: bigint;
    routeToSubProcessId: number;
    responsibleEmployeeId?: number | null;
    sourceTaskId: bigint;
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
      status: { in: ["PENDING", "ASSIGNED", "CORRECTION_REQUIRED", "CHECKING", "COMPLETED"] },
    },
    orderBy: { id: "desc" },
  });

  let assigneeId = input.responsibleEmployeeId ?? existing?.assignedEmployeeId ?? null;
  if (!assigneeId && subProcess.defaultRoleId) {
    const map = await resolveEmployeesForRoles([subProcess.defaultRoleId]);
    assigneeId = map.get(subProcess.defaultRoleId) ?? null;
  }

  // Rework of an already-released stage: reopen as ASSIGNED for immediate work
  if (existing && ["PENDING", "ASSIGNED", "CORRECTION_REQUIRED"].includes(existing.status)) {
    return tx.designTask.update({
      where: { id: existing.id },
      data: {
        status: "ASSIGNED",
        assignedEmployeeId: assigneeId ?? existing.assignedEmployeeId,
        completedAt: null,
        outputRemark: null,
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

  const siblings = await tx.designTask.findMany({
    where: { designId: input.designId },
    select: { id: true, dependencySequence: true, sequence: true, status: true },
  });
  const sourceSeq = source
    ? effectiveDependencySequence(source)
    : dependencySequence - 1;
  const adjusted = siblings.map((s) => ({
    ...s,
    status: effectiveDependencySequence(s) === sourceSeq ? "COMPLETED" : s.status,
  }));
  const ready = isTaskReady(
    { id: "routed", dependencySequence, sequence, status: "PENDING" },
    adjusted,
  );

  return tx.designTask.create({
    data: {
      designId: input.designId,
      processId: subProcess.processId,
      subProcessId: subProcess.id,
      assignedEmployeeId: assigneeId,
      assignedRoleId: subProcess.defaultRoleId ?? source?.assignedRoleId ?? 1,
      status: initialStatusForCreate({ hasAssignee: !!assigneeId, isReady: ready }),
      priority: source?.priority ?? "HIGH",
      expectedMinutes: source?.expectedMinutes ?? 120,
      sequence,
      dependencySequence,
    },
  });
}

export async function listCorrections(filters: {
  designId?: bigint;
  responsibleEmployeeId?: number;
  status?: CorrectionStatus;
}) {
  return prisma.designCorrection.findMany({
    where: {
      ...(filters.designId ? { designId: filters.designId } : {}),
      ...(filters.responsibleEmployeeId
        ? { responsibleEmployeeId: filters.responsibleEmployeeId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
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
    const existing = await tx.designCorrection.findUnique({ where: { id } });
    if (!existing) throw new ApiError("Correction not found", 404);

    const updated = await tx.designCorrection.update({
      where: { id },
      data: input,
      include: correctionInclude,
    });

    if (input.status === "DONE" && existing.status !== "DONE") {
      const sourceTask = await tx.designTask.findUnique({
        where: { id: existing.taskId },
        include: { subProcess: { select: { code: true } } },
      });
      if (sourceTask && sourceTask.status === "CORRECTION_REQUIRED") {
        // If work was routed elsewhere, close the source check task; otherwise restore for rework
        const nextStatus = existing.routedTaskId ? "COMPLETED" : "ASSIGNED";
        await tx.designTask.update({
          where: { id: sourceTask.id },
          data: {
            status: nextStatus,
            completedAt: nextStatus === "COMPLETED" ? new Date() : null,
            version: { increment: 1 },
          },
        });
        if (nextStatus === "COMPLETED") {
          await unlockNextDependentTasks(
            tx,
            {
              id: sourceTask.id,
              designId: sourceTask.designId,
              dependencySequence: sourceTask.dependencySequence,
              sequence: sourceTask.sequence,
              subProcessCode: sourceTask.subProcess.code,
            },
            correlationId,
          );
        }
      }

      // Unlock dependents from the routed rework task if it is still open for assignee
      if (existing.routedTaskId) {
        const routed = await tx.designTask.findUnique({ where: { id: existing.routedTaskId } });
        if (routed && routed.status === "ASSIGNED") {
          // leave assigned for rework; unlock is when that task completes via endTask
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
