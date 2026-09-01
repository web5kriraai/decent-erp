import type { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule, notFound } from "@/lib/errors/create-app-error";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { resolveEmployeeForRole } from "@/lib/services/assignment-service";
import {
  isDesignClosedForOverride,
  isOpenTaskStatus,
  isQcCheckTask,
  isTerminalTaskStatus,
} from "@/lib/services/workflow-override-utils";

type TaskRow = {
  id: bigint;
  designId: bigint;
  sequence: number;
  status: string;
  assignedEmployeeId: number | null;
  assignedRoleId: number;
  subProcess: { code: string; name: string; isApproval: boolean };
};

const taskInclude = {
  subProcess: { select: { code: true, name: true, isApproval: true } },
} as const;

async function loadDesignTasks(designId: bigint): Promise<{
  design: { id: bigint; status: string; currentStage: string | null; ideaRef: string };
  tasks: TaskRow[];
}> {
  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    select: {
      id: true,
      status: true,
      currentStage: true,
      ideaRef: true,
    },
  });
  if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);

  const tasks = (await prisma.designTask.findMany({
    where: { designId },
    orderBy: { sequence: "asc" },
    include: taskInclude,
  })) as TaskRow[];

  return { design, tasks };
}

async function pauseActiveTasks(
  tx: Prisma.TransactionClient,
  designId: bigint,
  actorId: number,
  reason: string,
): Promise<void> {
  const now = new Date();
  const running = await tx.designTask.findMany({
    where: { designId, status: "RUNNING" },
    select: { id: true, assignedEmployeeId: true },
  });

  for (const task of running) {
    if (task.assignedEmployeeId == null) continue;
    await tx.taskTimeEvent.create({
      data: {
        taskId: task.id,
        employeeId: task.assignedEmployeeId,
        eventType: "END",
        remark: `Workflow override: ${reason}`,
        eventTimeUtc: now,
        createdById: actorId,
      },
    });
    await tx.designTask.update({
      where: { id: task.id },
      data: { status: "ASSIGNED", version: { increment: 1 } },
    });
  }
}

async function skipOpenTasksBeforeTarget(
  tx: Prisma.TransactionClient,
  tasks: TaskRow[],
  target: TaskRow,
  reason: string,
  actorId: number,
): Promise<bigint[]> {
  const now = new Date();
  const skipped: bigint[] = [];

  for (const task of tasks) {
    if (task.id === target.id) continue;
    if (task.sequence >= target.sequence) continue;
    if (isTerminalTaskStatus(task.status)) continue;

    await tx.designTask.update({
      where: { id: task.id },
      data: {
        status: "SKIPPED",
        skipReason: reason,
        skippedAt: now,
        skippedById: actorId,
        version: { increment: 1 },
      },
    });
    skipped.push(task.id);
  }

  return skipped;
}

async function resetOpenTasksAfterTarget(
  tx: Prisma.TransactionClient,
  tasks: TaskRow[],
  target: TaskRow,
): Promise<void> {
  for (const task of tasks) {
    if (task.sequence <= target.sequence) continue;
    if (task.status === "COMPLETED" || task.status === "CANCELLED") continue;

    await tx.designTask.update({
      where: { id: task.id },
      data: {
        status: task.assignedEmployeeId ? "ASSIGNED" : "PENDING",
        skipReason: null,
        skippedAt: null,
        skippedById: null,
        version: { increment: 1 },
      },
    });
  }
}

async function assignLandingTask(
  tx: Prisma.TransactionClient,
  target: TaskRow,
  assigneeId: number | null | undefined,
): Promise<number | null> {
  let resolved = assigneeId ?? target.assignedEmployeeId;
  if (!resolved) {
    resolved = await resolveEmployeeForRole(target.assignedRoleId);
  }

  await tx.designTask.update({
    where: { id: target.id },
    data: {
      status: "ASSIGNED",
      assignedEmployeeId: resolved,
      skipReason: null,
      skippedAt: null,
      skippedById: null,
      version: { increment: 1 },
    },
  });

  return resolved;
}

function assertDesignOpen(status: string): void {
  if (isDesignClosedForOverride(status)) {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_DESIGN_CLOSED,
      { status },
      "Cannot override workflow: this design is already closed.",
    );
  }
}

function findTargetTask(tasks: TaskRow[], targetTaskId: bigint): TaskRow {
  const target = tasks.find((t) => t.id === targetTaskId);
  if (!target) {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_TARGET_INVALID,
      { targetTaskId: targetTaskId.toString() },
      "Target task does not belong to this design.",
    );
  }
  return target;
}

function assertTargetNotCompleted(target: TaskRow): void {
  if (target.status === "COMPLETED") {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_TARGET_INVALID,
      { taskId: target.id.toString() },
      "This phase is already completed. Choose a later or open stage instead.",
    );
  }
}

function assertQcTarget(target: TaskRow): void {
  if (!isQcCheckTask(target.subProcess)) {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_TARGET_INVALID,
      { code: target.subProcess.code },
      "Send to QC is only allowed for check, approval, or review stages.",
    );
  }
}

function currentOpenStage(tasks: TaskRow[]): string | null {
  const open = tasks.find((t) => isOpenTaskStatus(t.status));
  return open?.subProcess.code ?? null;
}

export async function sendDesignToQcPhase(
  designId: bigint,
  targetTaskId: bigint,
  reason: string,
  actorId: number,
  correlationId: string,
  assigneeId?: number,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    throw businessRule(
      APP_ERROR_CODES.VALIDATION_FAILED,
      undefined,
      "Please provide a reason of at least 10 characters.",
    );
  }

  const { design, tasks } = await loadDesignTasks(designId);
  assertDesignOpen(design.status);

  const target = findTargetTask(tasks, targetTaskId);
  assertTargetNotCompleted(target);
  assertQcTarget(target);

  const fromStage = design.currentStage ?? currentOpenStage(tasks);

  return prisma.$transaction(async (tx) => {
    await pauseActiveTasks(tx, designId, actorId, trimmed);
    const skippedTaskIds = await skipOpenTasksBeforeTarget(tx, tasks, target, trimmed, actorId);
    const landingAssignee = await assignLandingTask(tx, target, assigneeId);

    await tx.designConcept.update({
      where: { id: designId },
      data: { currentStage: target.subProcess.code },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "WORKFLOW_SEND_QC",
      userId: actorId,
      correlationId,
      before: { currentStage: fromStage },
      after: {
        targetTaskId: target.id.toString(),
        targetCode: target.subProcess.code,
        reason: trimmed,
        skippedTaskIds: skippedTaskIds.map(String),
      },
    });

    if (landingAssignee != null) {
      await enqueueOutboxAndNotify(
        "TASK_ASSIGNED",
        { taskId: target.id.toString(), employeeId: landingAssignee },
        correlationId,
      );
    }

    return { targetCode: target.subProcess.code, skippedCount: skippedTaskIds.length };
  });
}

export async function bypassDesignToPhase(
  designId: bigint,
  targetTaskId: bigint,
  reason: string,
  actorId: number,
  correlationId: string,
  assigneeId?: number,
) {
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    throw businessRule(
      APP_ERROR_CODES.VALIDATION_FAILED,
      undefined,
      "Please provide a reason of at least 10 characters.",
    );
  }

  const { design, tasks } = await loadDesignTasks(designId);
  assertDesignOpen(design.status);

  const target = findTargetTask(tasks, targetTaskId);
  assertTargetNotCompleted(target);

  const fromStage = design.currentStage ?? currentOpenStage(tasks);
  const openBeforeTarget = tasks.some(
    (t) => t.sequence < target.sequence && isOpenTaskStatus(t.status),
  );
  const direction = openBeforeTarget ? "forward" : "backward";

  return prisma.$transaction(async (tx) => {
    await pauseActiveTasks(tx, designId, actorId, trimmed);

    let skippedTaskIds: bigint[] = [];
    if (direction === "forward") {
      skippedTaskIds = await skipOpenTasksBeforeTarget(tx, tasks, target, trimmed, actorId);
    } else {
      await resetOpenTasksAfterTarget(tx, tasks, target);
    }

    const landingAssignee = await assignLandingTask(tx, target, assigneeId);

    await tx.designConcept.update({
      where: { id: designId },
      data: { currentStage: target.subProcess.code },
    });

    await writeAuditLog(tx, {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: "WORKFLOW_BYPASS",
      userId: actorId,
      correlationId,
      before: { currentStage: fromStage },
      after: {
        targetTaskId: target.id.toString(),
        targetCode: target.subProcess.code,
        reason: trimmed,
        direction,
        skippedTaskIds: skippedTaskIds.map(String),
      },
    });

    if (landingAssignee != null) {
      await enqueueOutboxAndNotify(
        "TASK_ASSIGNED",
        { taskId: target.id.toString(), employeeId: landingAssignee },
        correlationId,
      );
    }

    return { targetCode: target.subProcess.code, direction, skippedCount: skippedTaskIds.length };
  });
}
