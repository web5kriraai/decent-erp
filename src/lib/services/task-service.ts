import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-utils";
import type { Priority, TaskStatus } from "@prisma/client";

export async function getMyTasks(employeeId: number) {
  return prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
    include: {
      design: { select: { id: true, ideaRef: true, collectionName: true } },
      process: true,
      subProcess: true,
      timeEvents: { orderBy: { eventTimeUtc: "asc" } },
    },
  });
}

export async function assignTask(
  taskId: bigint,
  employeeId: number,
  actorId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({ where: { id: taskId } });
    if (!task) throw new ApiError("Task not found", 404);

    const employee = await tx.employee.findUnique({ where: { id: employeeId, active: true } });
    if (!employee) throw new ApiError("Employee not found", 404);

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: {
        assignedEmployeeId: employeeId,
        status: task.status === "PENDING" ? "ASSIGNED" : task.status,
        version: { increment: 1 },
      },
      include: {
        assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
        process: true,
        subProcess: true,
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: taskId.toString(),
      action: "ASSIGN",
      userId: actorId,
      correlationId,
      before: task,
      after: updated,
    });

    return updated;
  }).then(async (task) => {
    await enqueueOutboxAndNotify(
      "TASK_ASSIGNED",
      { taskId: task.id.toString(), employeeId },
      correlationId,
    );
    return task;
  });
}

export async function createManualTask(
  input: {
    designId: bigint;
    processId: number;
    subProcessId: number;
    assignedEmployeeId?: number;
    assignedRoleId: number;
    expectedMinutes: number;
    priority: Priority;
  },
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.designTask.create({
      data: {
        ...input,
        status: input.assignedEmployeeId ? "ASSIGNED" : "PENDING",
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: task.id.toString(),
      action: "CREATE",
      userId,
      correlationId,
      after: task,
    });

    return task;
  });
}

async function getTaskForEmployee(taskId: bigint, employeeId: number) {
  const task = await prisma.designTask.findUnique({ where: { id: taskId } });
  if (!task) throw new ApiError("Task not found", 404);
  if (task.assignedEmployeeId !== employeeId) {
    throw new ApiError("Task not assigned to you", 403);
  }
  return task;
}

export async function startTask(taskId: bigint, employeeId: number, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    const running = await tx.designTask.findFirst({
      where: { assignedEmployeeId: employeeId, status: "RUNNING" },
    });
    if (running && running.id !== taskId) {
      throw new ApiError("Another task is already running", 409, {
        runningTaskId: running.id.toString(),
      });
    }

    const task = await tx.designTask.findUnique({ where: { id: taskId } });
    if (!task) throw new ApiError("Task not found", 404);
    if (task.assignedEmployeeId !== employeeId) {
      throw new ApiError("Task not assigned to you", 403);
    }
    if (!["PENDING", "ASSIGNED", "ON_HOLD"].includes(task.status)) {
      throw new ApiError(`Cannot start task in status ${task.status}`, 409);
    }

    const now = new Date();
    await tx.taskTimeEvent.create({
      data: {
        taskId,
        employeeId,
        eventType: "START",
        eventTimeUtc: now,
        createdById: employeeId,
      },
    });

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: {
        status: "RUNNING",
        startedAt: task.startedAt ?? now,
        version: { increment: 1 },
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: taskId.toString(),
      action: "START",
      userId: employeeId,
      correlationId,
      before: task,
      after: updated,
    });

    return updated;
  });
}

export async function holdTask(
  taskId: bigint,
  employeeId: number,
  holdReasonId: number,
  remark: string | undefined,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await getTaskForEmployee(taskId, employeeId);
    if (task.status !== "RUNNING") {
      throw new ApiError("Task must be RUNNING to hold", 409);
    }

    const now = new Date();
    await tx.taskTimeEvent.create({
      data: {
        taskId,
        employeeId,
        eventType: "HOLD",
        holdReasonId,
        remark,
        eventTimeUtc: now,
        createdById: employeeId,
      },
    });

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: { status: "ON_HOLD", version: { increment: 1 } },
    });

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: taskId.toString(),
      action: "HOLD",
      userId: employeeId,
      correlationId,
      after: updated,
    });

    return updated;
  });
}

export async function resumeTask(
  taskId: bigint,
  employeeId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await getTaskForEmployee(taskId, employeeId);
    if (task.status !== "ON_HOLD") {
      throw new ApiError("Task must be ON_HOLD to resume", 409);
    }

    const now = new Date();
    await tx.taskTimeEvent.create({
      data: {
        taskId,
        employeeId,
        eventType: "RESUME",
        eventTimeUtc: now,
        createdById: employeeId,
      },
    });

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: { status: "RUNNING", version: { increment: 1 } },
    });

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: taskId.toString(),
      action: "RESUME",
      userId: employeeId,
      correlationId,
      after: updated,
    });

    return updated;
  });
}

export async function endTask(
  taskId: bigint,
  employeeId: number,
  input: {
    completionStatus: TaskStatus;
    outputRemark: string;
    version: number;
    attachmentIds?: number[];
    checklist?: Array<{ itemId: number; result: boolean; remark?: string }>;
    checklistNote?: string;
  },
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({
      where: { id: taskId },
      include: { subProcess: true },
    });
    if (!task) throw new ApiError("Task not found", 404);
    if (task.assignedEmployeeId !== employeeId) {
      throw new ApiError("Task not assigned to you", 403);
    }
    if (task.version !== input.version) {
      throw new ApiError("Concurrency conflict - refresh and retry", 409);
    }
    if (!["RUNNING", "ON_HOLD"].includes(task.status)) {
      throw new ApiError(`Cannot end task in status ${task.status}`, 409);
    }

    const requiredChecklist = await tx.qualityChecklistItem.findMany({
      where: { subProcessId: task.subProcessId, active: true },
    });
    if (requiredChecklist.length > 0) {
      const submitted = new Map(
        (input.checklist ?? []).map((c) => [c.itemId, c] as const),
      );
      const sharedNote = input.checklistNote?.trim() || "";
      let passedCount = 0;
      let failedCount = 0;

      for (const item of requiredChecklist) {
        const entry = submitted.get(item.id);
        if (!entry) {
          throw new ApiError(`Checklist item "${item.name}" is required`, 422);
        }
        if (entry.result) {
          passedCount += 1;
          continue;
        }
        failedCount += 1;
        const itemNote = entry.remark?.trim() || sharedNote;
        if (!itemNote) {
          throw new ApiError(
            `Checklist item "${item.name}" must pass, or include a note explaining why it did not`,
            422,
          );
        }
      }

      if (passedCount === 0) {
        throw new ApiError(
          "Mark at least one checklist item as passed before completing the task",
          422,
        );
      }

      // Attach shared note onto failed entries for persistence
      if (failedCount > 0 && sharedNote && input.checklist) {
        input.checklist = input.checklist.map((c) =>
          c.result ? c : { ...c, remark: c.remark?.trim() || sharedNote },
        );
      }
    }

    if (task.subProcess.isFileRequired) {
      const imageCount = await tx.designImage.count({ where: { designId: task.designId } });
      const attachmentCount = input.attachmentIds?.length ?? 0;
      if (imageCount === 0 && attachmentCount === 0) {
        throw new ApiError("At least one file must be uploaded before completing this task", 422);
      }
    }

    const now = new Date();
    const nextStatus =
      input.completionStatus === "CHECKING" ? "CHECKING" : "COMPLETED";

    await tx.taskTimeEvent.create({
      data: {
        taskId,
        employeeId,
        eventType: "END",
        remark: input.outputRemark,
        eventTimeUtc: now,
        createdById: employeeId,
      },
    });

    if (input.checklist?.length) {
      for (const entry of input.checklist) {
        await tx.taskChecklistResult.upsert({
          where: { taskId_itemId: { taskId, itemId: entry.itemId } },
          update: { result: entry.result, remark: entry.remark },
          create: {
            taskId,
            itemId: entry.itemId,
            result: entry.result,
            remark: entry.remark,
          },
        });
      }
    }

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: {
        status: nextStatus,
        outputRemark: input.outputRemark,
        completedAt: now,
        version: { increment: 1 },
      },
    });

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: taskId.toString(),
      action: "END",
      userId: employeeId,
      correlationId,
      before: task,
      after: updated,
    });

    await enqueueOutboxAndNotify(
      "TASK_COMPLETED",
      { taskId: taskId.toString(), designId: task.designId.toString() },
      correlationId,
    );

    return updated;
  });
}

export async function closeWorkday(employeeId: number, correlationId: string) {
  const { persistWorkdayClose } = await import("@/lib/services/time-service");
  return persistWorkdayClose(employeeId, correlationId);
}

export async function adminAdjustTaskTime(
  taskId: bigint,
  adminId: number,
  remark: string,
  adjustActiveSeconds: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({ where: { id: taskId } });
    if (!task) throw new ApiError("Task not found", 404);

    const event = await tx.taskTimeEvent.create({
      data: {
        taskId,
        employeeId: task.assignedEmployeeId ?? adminId,
        eventType: "ADMIN_ADJUSTMENT",
        remark: `${remark} (adjust: ${adjustActiveSeconds}s)`,
        createdById: adminId,
      },
    });

    await writeAuditLog(tx, {
      entityType: "TaskTimeEvent",
      entityId: event.id.toString(),
      action: "ADMIN_ADJUSTMENT",
      userId: adminId,
      correlationId,
      after: { adjustActiveSeconds, remark },
    });

    return event;
  });
}
