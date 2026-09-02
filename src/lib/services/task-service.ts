import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { enqueueOutboxAndNotify } from "@/lib/notifications";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import {
  businessRule,
  conflict,
  createAppError,
  notFound,
} from "@/lib/errors/create-app-error";
import type { Priority, TaskStatus } from "@prisma/client";
import {
  DEPENDENCY_SATISFIED_STATUSES,
  MY_TASKS_VISIBLE_STATUSES,
  effectiveDependencySequence,
  initialStatusForCreate,
  isTaskReady,
} from "@/lib/services/task-dependency";
import { unlockNextDependentTasks } from "@/lib/services/task-dependency-unlock";
import { raiseCorrectionInTransaction } from "@/lib/services/correction-service";
import { workSubProcessCodeForApproval } from "@/lib/services/stage-approval-queue";
import { canRoleActOnStageApproval } from "@/lib/stage-approval-rbac";
import { isStageApprovalActionable } from "@/lib/design-workflow";
import { releaseToProduction } from "@/lib/services/production-service";
import { resolveStatusAfterAssign, reconcileEmployeeTasksReadiness } from "@/lib/services/task-readiness";
import { enrichEmployeeTasks } from "@/lib/services/task-workflow-enrichment";
import { sortTasksByEffectivePriority } from "@/lib/task-priority";
import { resolveWorkTaskEndStatus, findCheckingWorkTasksReleasedByApproval } from "@/lib/services/workflow-stage-gate";
import type { Prisma } from "@prisma/client";

async function promoteGatedWorkTasksAfterApproval(
  tx: Prisma.TransactionClient,
  approvalTask: {
    id: bigint;
    designId: bigint;
    dependencySequence: number | null;
    sequence: number;
  },
  actorId: number,
  correlationId: string,
) {
  const siblings = await tx.designTask.findMany({
    where: { designId: approvalTask.designId },
    select: {
      id: true,
      dependencySequence: true,
      sequence: true,
      status: true,
      assignedEmployeeId: true,
      subProcess: { select: { name: true, code: true, isApproval: true } },
      assignedEmployee: { select: { name: true } },
    },
    orderBy: { sequence: "asc" },
  });

  const stageSiblings = siblings.map((s) => ({
    id: s.id.toString(),
    dependencySequence: s.dependencySequence,
    sequence: s.sequence,
    status: s.status,
    assignedEmployeeId: s.assignedEmployeeId,
    subProcess: s.subProcess,
    assignedEmployee: s.assignedEmployee,
  }));

  const workTasks = findCheckingWorkTasksReleasedByApproval(
    {
      id: approvalTask.id.toString(),
      dependencySequence: approvalTask.dependencySequence,
      sequence: approvalTask.sequence,
    },
    stageSiblings,
  );

  for (const work of workTasks) {
    const workId = BigInt(work.id);
    const before = siblings.find((s) => s.id === workId);
    const updated = await tx.designTask.update({
      where: { id: workId },
      data: { status: "COMPLETED", version: { increment: 1 } },
    });
    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: work.id,
      action: "PROMOTE_AFTER_APPROVAL",
      userId: actorId,
      correlationId,
      before,
      after: updated,
    });
  }
}

export async function getMyTasks(employeeId: number) {
  await reconcileEmployeeTasksReadiness(employeeId, `my-tasks-${employeeId}`);

  const tasks = await prisma.designTask.findMany({
    where: {
      assignedEmployeeId: employeeId,
      status: { in: [...MY_TASKS_VISIBLE_STATUSES] },
    },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
    include: {
      design: { select: { id: true, ideaRef: true, collectionName: true, priority: true } },
      process: true,
      subProcess: true,
      timeEvents: { orderBy: { eventTimeUtc: "asc" } },
    },
  });

  return sortTasksByEffectivePriority(await enrichEmployeeTasks(tasks));
}

export async function assignTask(
  taskId: bigint,
  employeeId: number,
  actorId: number,
  correlationId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({ where: { id: taskId } });
    if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);

    const employee = await tx.employee.findUnique({ where: { id: employeeId, active: true } });
    if (!employee) throw notFound();

    const siblings = await tx.designTask.findMany({
      where: { designId: task.designId },
      select: { id: true, dependencySequence: true, sequence: true, status: true },
    });
    const ready = isTaskReady(
      {
        id: task.id.toString(),
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );

    // ASSIGNED only when dependencies are satisfied; otherwise stay PENDING until unlocked.
    const nextStatus = resolveStatusAfterAssign({
      currentStatus: task.status,
      hasAssignee: true,
      isReady: ready,
    });

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: {
        assignedEmployeeId: employeeId,
        status: nextStatus,
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

    return { updated, notify: nextStatus === "ASSIGNED" };
  });

  if (result.notify) {
    await enqueueOutboxAndNotify(
      "TASK_ASSIGNED",
      { taskId: result.updated.id.toString(), employeeId },
      correlationId,
    );
  }
  return result.updated;
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
    sequence?: number;
    dependencySequence?: number | null;
  },
  userId: number,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const siblings = await tx.designTask.findMany({
      where: { designId: input.designId },
      select: { id: true, dependencySequence: true, sequence: true, status: true },
    });
    const maxSeq = siblings.reduce((m, s) => Math.max(m, s.sequence), 0);
    const sequence = input.sequence ?? maxSeq + 1;
    const dependencySequence =
      input.dependencySequence !== undefined ? input.dependencySequence : sequence;
    const tentative = {
      id: "new",
      dependencySequence,
      sequence,
      status: "PENDING",
    };
    const ready = isTaskReady(tentative, siblings);
    const status = initialStatusForCreate({
      hasAssignee: input.assignedEmployeeId != null,
      isReady: ready,
    });

    const task = await tx.designTask.create({
      data: {
        designId: input.designId,
        processId: input.processId,
        subProcessId: input.subProcessId,
        assignedEmployeeId: input.assignedEmployeeId,
        assignedRoleId: input.assignedRoleId,
        expectedMinutes: input.expectedMinutes,
        priority: input.priority,
        sequence,
        dependencySequence,
        status,
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
  if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);
  if (task.assignedEmployeeId !== employeeId) {
    throw createAppError(APP_ERROR_CODES.TASK_NOT_ASSIGNED, 403);
  }
  return task;
}

/** Ensures the task exists and is assigned to the employee (for API route guards). */
export async function assertTaskAssignedToEmployee(taskId: bigint, employeeId: number) {
  return getTaskForEmployee(taskId, employeeId);
}

export async function startTask(taskId: bigint, employeeId: number, correlationId: string) {
  return prisma.$transaction(async (tx) => {
    const { startOfUtcDay } = await import("@/lib/services/time-calculation");
    const workDate = startOfUtcDay(new Date());
    const closed = await tx.workdaySession.findUnique({
      where: { employeeId_workDate: { employeeId, workDate } },
    });
    if (closed) {
      throw conflict(APP_ERROR_CODES.WORKDAY_CLOSED);
    }

    const running = await tx.designTask.findFirst({
      where: { assignedEmployeeId: employeeId, status: "RUNNING" },
    });
    if (running && running.id !== taskId) {
      throw conflict(APP_ERROR_CODES.TASK_ALREADY_RUNNING, {
        runningTaskId: running.id.toString(),
      });
    }

    const task = await tx.designTask.findUnique({ where: { id: taskId } });
    if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);
    if (task.assignedEmployeeId !== employeeId) {
      throw createAppError(APP_ERROR_CODES.TASK_NOT_ASSIGNED, 403);
    }
    if (task.status === "ON_HOLD") {
      throw conflict(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        undefined,
        "This task is on hold. Resume it instead of starting again.",
      );
    }

    const siblingRows = await tx.designTask.findMany({
      where: { designId: task.designId },
      select: {
        id: true,
        dependencySequence: true,
        sequence: true,
        status: true,
        subProcess: { select: { name: true, code: true } },
      },
      orderBy: [{ dependencySequence: "asc" }, { sequence: "asc" }],
    });

    const blocker = siblingRows.find(
      (s) =>
        s.id !== taskId &&
        s.sequence < task.sequence &&
        !DEPENDENCY_SATISFIED_STATUSES.includes(
          s.status as (typeof DEPENDENCY_SATISFIED_STATUSES)[number],
        ),
    );

    if (blocker) {
      const label = blocker.subProcess?.name ?? blocker.subProcess?.code ?? "prior task";
      throw businessRule(
        APP_ERROR_CODES.TASK_DEPENDENCY_BLOCKED,
        { blockerTaskId: blocker.id.toString() },
        `Cannot start — “${label}” must be completed or sent for checking first.`,
      );
    }

    let activeTask = task;
    if (task.status === "PENDING") {
      activeTask = await tx.designTask.update({
        where: { id: taskId },
        data: { status: "ASSIGNED", version: { increment: 1 } },
      });
    } else if (task.status === "CORRECTION_REQUIRED") {
      activeTask = await tx.designTask.update({
        where: { id: taskId },
        data: { status: "ASSIGNED", version: { increment: 1 } },
      });
    } else if (task.status !== "ASSIGNED") {
      throw conflict(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        { status: task.status },
        "Only assigned tasks can be started.",
      );
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
        startedAt: activeTask.startedAt ?? now,
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
  version?: number,
) {
  return prisma.$transaction(async (tx) => {
    const task = await getTaskForEmployee(taskId, employeeId);
    if (task.status !== "RUNNING") {
      throw conflict(APP_ERROR_CODES.TASK_WRONG_STATUS, undefined, "Task must be running before it can be held.");
    }
    if (version != null && task.version !== version) {
      throw conflict(APP_ERROR_CODES.CONCURRENCY_CONFLICT);
    }

    const reason = await tx.taskHoldReason.findFirst({
      where: { id: holdReasonId, active: true },
    });
    if (!reason) {
      throw businessRule(APP_ERROR_CODES.VALIDATION_FAILED, undefined, "Choose a valid hold reason.");
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
  version?: number,
) {
  return prisma.$transaction(async (tx) => {
    const task = await getTaskForEmployee(taskId, employeeId);
    if (task.status !== "ON_HOLD") {
      throw conflict(APP_ERROR_CODES.TASK_WRONG_STATUS, undefined, "Only on-hold tasks can be resumed.");
    }
    if (version != null && task.version !== version) {
      throw conflict(APP_ERROR_CODES.CONCURRENCY_CONFLICT);
    }

    const running = await tx.designTask.findFirst({
      where: { assignedEmployeeId: employeeId, status: "RUNNING" },
    });
    if (running && running.id !== taskId) {
      throw conflict(APP_ERROR_CODES.TASK_ALREADY_RUNNING, {
        runningTaskId: running.id.toString(),
      });
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
    sampleOutcome?: "APPROVE" | "REJECT" | "RESAMPLE";
  },
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({
      where: { id: taskId },
      include: { subProcess: true },
    });
    if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);
    if (task.assignedEmployeeId !== employeeId) {
      throw createAppError(APP_ERROR_CODES.TASK_NOT_ASSIGNED, 403);
    }
    if (task.version !== input.version) {
      throw conflict(APP_ERROR_CODES.CONCURRENCY_CONFLICT);
    }
    if (!["RUNNING", "ON_HOLD"].includes(task.status)) {
      throw conflict(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        { status: task.status },
        "Only running or on-hold tasks can be completed.",
      );
    }

    const isSampleCheck = task.subProcess.code === "SAMPLE_CHECK";
    if (isSampleCheck && !input.sampleOutcome) {
      throw businessRule(APP_ERROR_CODES.SAMPLE_OUTCOME_REQUIRED);
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
          throw businessRule(
            APP_ERROR_CODES.CHECKLIST_INCOMPLETE,
            { itemId: item.id },
            `Checklist item “${item.name}” is required.`,
          );
        }
        if (entry.result) {
          passedCount += 1;
          continue;
        }
        failedCount += 1;
        const itemNote = entry.remark?.trim() || sharedNote;
        if (!itemNote) {
          throw businessRule(
            APP_ERROR_CODES.CHECKLIST_INCOMPLETE,
            { itemId: item.id },
            `Checklist item “${item.name}” must pass, or include a note explaining why it did not.`,
          );
        }
      }

      if (passedCount === 0) {
        throw businessRule(
          APP_ERROR_CODES.CHECKLIST_INCOMPLETE,
          undefined,
          "Mark at least one checklist item as passed before completing the task.",
        );
      }

      if (isSampleCheck && input.sampleOutcome === "APPROVE" && failedCount > 0) {
        throw businessRule(
          APP_ERROR_CODES.CHECKLIST_INCOMPLETE,
          undefined,
          "All checklist items must pass to approve the sample. Use Reject or Re-sample instead.",
        );
      }

      if (failedCount > 0 && sharedNote && input.checklist) {
        input.checklist = input.checklist.map((c) =>
          c.result ? c : { ...c, remark: c.remark?.trim() || sharedNote },
        );
      }
    }

    if (task.subProcess.isFileRequired) {
      const artifactCount = await tx.taskArtifact.count({
        where: { taskId, storageKey: { not: null } },
      });
      if (artifactCount === 0) {
        throw businessRule(APP_ERROR_CODES.REQUIRED_FILE_MISSING);
      }
    }

    const now = new Date();
    const siblingRows = await tx.designTask.findMany({
      where: { designId: task.designId },
      select: {
        id: true,
        dependencySequence: true,
        sequence: true,
        status: true,
        assignedEmployeeId: true,
        subProcess: { select: { code: true, name: true, isApproval: true } },
        assignedEmployee: { select: { name: true } },
      },
      orderBy: { sequence: "asc" },
    });
    const stageSiblings = siblingRows.map((s) => ({
      id: s.id.toString(),
      dependencySequence: s.dependencySequence,
      sequence: s.sequence,
      status: s.status,
      assignedEmployeeId: s.assignedEmployeeId,
      subProcess: s.subProcess,
      assignedEmployee: s.assignedEmployee,
    }));

    let nextStatus: TaskStatus =
      isSampleCheck
        ? input.completionStatus === "CHECKING"
          ? "CHECKING"
          : "COMPLETED"
        : resolveWorkTaskEndStatus(
            {
              id: task.id.toString(),
              dependencySequence: task.dependencySequence,
              sequence: task.sequence,
              subProcess: task.subProcess,
            },
            stageSiblings,
            input.completionStatus === "CHECKING" ? "CHECKING" : "COMPLETED",
          );

    if (isSampleCheck) {
      if (input.sampleOutcome === "APPROVE") {
        nextStatus = "COMPLETED";
        await tx.designImage.updateMany({
          where: { designId: task.designId },
          data: { reviewStatus: "APPROVED", reviewNote: null },
        });
      } else if (input.sampleOutcome === "REJECT") {
        nextStatus = "CORRECTION_REQUIRED";
        await tx.designImage.updateMany({
          where: { designId: task.designId, isPrimary: false },
          data: {
            reviewStatus: "REJECTED",
            reviewNote: input.outputRemark || "Image not approved during sample checking",
          },
        });

        const machineSample = await tx.designTask.findFirst({
          where: { designId: task.designId, subProcess: { code: "MACHINE_SAMPLE" } },
          orderBy: { id: "desc" },
          include: { subProcess: { select: { id: true } } },
        });
        const routeSub =
          machineSample?.subProcess ??
          (await tx.designSubProcessMaster.findFirst({
            where: { code: "MACHINE_SAMPLE", active: true },
            select: { id: true },
          }));

        await raiseCorrectionInTransaction(
          tx,
          {
            designId: task.designId,
            taskId: task.id,
            correctionType: "IMPROVEMENT",
            responsibleEmployeeId: machineSample?.assignedEmployeeId ?? null,
            routeToSubProcessId: routeSub?.id ?? null,
            rootCause: input.outputRemark || "Sample checking rejected — rework required",
          },
          employeeId,
          correlationId,
        );
      } else if (input.sampleOutcome === "RESAMPLE") {
        // Record this check attempt as complete, but do not unlock Costing —
        // Machine Operator reworks via RESAMPLE, then Sample Checker must approve again.
        nextStatus = "COMPLETED";
        await spawnResampleTask(tx, task);
      }
    }

    const isResampleOutcome = isSampleCheck && input.sampleOutcome === "RESAMPLE";
    const isResampleTask = task.subProcess.code === "RESAMPLE";

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
        completedAt: nextStatus === "COMPLETED" || nextStatus === "CHECKING" ? now : null,
        version: { increment: 1 },
      },
    });

    // Sample REJECT already created DesignCorrection + routed rework via raiseCorrectionInTransaction
    // which also marked the check task CORRECTION_REQUIRED; keep outputRemark from this update.

    await tx.designConcept.update({
      where: { id: task.designId },
      data: {
        currentStage: isResampleOutcome
          ? "RESAMPLE"
          : siblingRows.find((s) => !["COMPLETED", "CHECKING", "CANCELLED"].includes(s.status))
              ?.subProcess.code ?? task.subProcess.code,
        ...(nextStatus === "CHECKING" ? { status: "ACTIVE" as const } : {}),
      },
    });

    if (nextStatus === "COMPLETED" || nextStatus === "CHECKING") {
      if (isResampleOutcome) {
        // Costing / later stages stay locked until SAMPLE_CHECK is approved after re-sample.
      } else if (isResampleTask && nextStatus === "COMPLETED") {
        await reopenSampleCheckAfterResample(tx, task.designId, correlationId);
      } else {
        if (task.subProcess.isApproval && nextStatus === "COMPLETED") {
          await promoteGatedWorkTasksAfterApproval(
            tx,
            {
              id: task.id,
              designId: task.designId,
              dependencySequence: task.dependencySequence,
              sequence: task.sequence,
            },
            employeeId,
            correlationId,
          );
        }

        await unlockNextDependentTasks(
          tx,
          {
            id: task.id,
            designId: task.designId,
            dependencySequence: task.dependencySequence,
            sequence: task.sequence,
            subProcessCode: task.subProcess.code,
          },
          correlationId,
        );
      }
    }

    const triggerProductionRelease =
      task.subProcess.code === "PROD_RELEASE" && nextStatus === "COMPLETED";

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

    return { updated, triggerProductionRelease };
  }).then(async (result) => {
    if (result.triggerProductionRelease) {
      await releaseToProduction(result.updated.designId, employeeId, correlationId);
    }
    return result.updated;
  });
}

/** One-step approve for workflow stage approval tasks (assign → start → complete). */
export async function completeStageApproval(
  taskId: bigint,
  employeeId: number,
  input: {
    outputRemark: string;
    version: number;
    decision?: "APPROVED" | "REJECT" | "CORRECTION_REQUIRED";
  },
  correlationId: string,
  roleCode?: string,
) {
  const decision = input.decision ?? "APPROVED";

  let effectiveRoleCode = roleCode;
  if (!effectiveRoleCode) {
    const actor = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { role: { select: { code: true } } },
    });
    effectiveRoleCode = actor?.role.code;
  }

  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.designTask.findUnique({
      where: { id: taskId },
      include: { subProcess: true },
    });
    if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);
    if (!task.subProcess.isApproval) {
      throw businessRule(APP_ERROR_CODES.APPROVAL_NOT_ALLOWED);
    }

    if (!canRoleActOnStageApproval(effectiveRoleCode, task.subProcess.code)) {
      throw createAppError(APP_ERROR_CODES.PERMISSION_DENIED, 403);
    }

    const workCode = workSubProcessCodeForApproval(task.subProcess.code);
    const linkedWork = workCode
      ? await tx.designTask.findFirst({
          where: { designId: task.designId, subProcess: { code: workCode } },
          orderBy: { id: "desc" },
          select: { status: true },
        })
      : null;
    if (!isStageApprovalActionable(task.subProcess.code, linkedWork ?? undefined)) {
      throw conflict(
        APP_ERROR_CODES.WORKFLOW_NOT_READY,
        undefined,
        "This approval cannot be recorded until prior work is submitted for checking.",
      );
    }

    if (task.version !== input.version) {
      throw conflict(APP_ERROR_CODES.CONCURRENCY_CONFLICT);
    }
    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      throw conflict(APP_ERROR_CODES.TASK_WRONG_STATUS, undefined, "This approval stage is already finished.");
    }

    let status = task.status;

    if (status === "PENDING") {
      const siblings = await tx.designTask.findMany({
        where: { designId: task.designId },
        select: { id: true, dependencySequence: true, sequence: true, status: true },
      });
      const ready = isTaskReady(
        {
          id: task.id.toString(),
          dependencySequence: task.dependencySequence,
          sequence: task.sequence,
          status: task.status,
        },
        siblings,
      );
      if (!ready) {
        throw conflict(APP_ERROR_CODES.WORKFLOW_NOT_READY, undefined, "This approval is not ready yet.");
      }
      await tx.designTask.update({
        where: { id: taskId },
        data: { status: "ASSIGNED", version: { increment: 1 } },
      });
      status = "ASSIGNED";
    }
    if (status === "ON_HOLD") {
      throw conflict(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        undefined,
        "Resume this task before recording the approval.",
      );
    }
    if (
      task.assignedEmployeeId != null &&
      task.assignedEmployeeId !== employeeId
    ) {
      throw createAppError(APP_ERROR_CODES.TASK_NOT_ASSIGNED, 403);
    }

    const now = new Date();

    if (task.assignedEmployeeId == null) {
      await tx.designTask.update({
        where: { id: taskId },
        data: { assignedEmployeeId: employeeId, version: { increment: 1 } },
      });
    }

    if (status === "ASSIGNED") {
      await tx.taskTimeEvent.create({
        data: {
          taskId,
          employeeId,
          eventType: "START",
          eventTimeUtc: now,
          createdById: employeeId,
        },
      });
      await tx.designTask.update({
        where: { id: taskId },
        data: {
          status: "RUNNING",
          startedAt: task.startedAt ?? now,
          version: { increment: 1 },
        },
      });
      status = "RUNNING";
    }

    if (!["RUNNING", "CHECKING"].includes(status)) {
      throw conflict(
        APP_ERROR_CODES.TASK_WRONG_STATUS,
        { status },
        "This approval cannot be recorded in the current task status.",
      );
    }

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

    if (decision === "REJECT" || decision === "CORRECTION_REQUIRED") {
      const workCode = workSubProcessCodeForApproval(task.subProcess.code);
      const workTask = workCode
        ? await tx.designTask.findFirst({
            where: { designId: task.designId, subProcess: { code: workCode } },
            orderBy: { id: "desc" },
            include: { subProcess: { select: { id: true } } },
          })
        : null;

      if (!workTask?.subProcess) {
        throw businessRule(
          APP_ERROR_CODES.WORKFLOW_NOT_READY,
          undefined,
          "Cannot route correction — related work stage not found.",
        );
      }

      await raiseCorrectionInTransaction(
        tx,
        {
          designId: task.designId,
          taskId: task.id,
          correctionType: "IMPROVEMENT",
          responsibleEmployeeId: workTask.assignedEmployeeId,
          routeToSubProcessId: workTask.subProcess.id,
          rootCause: input.outputRemark,
        },
        employeeId,
        correlationId,
      );

      const updated = await tx.designTask.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
          design: { select: { id: true, ideaRef: true, collectionName: true } },
          process: true,
          subProcess: true,
        },
      });

      await writeAuditLog(tx, {
        entityType: "DesignTask",
        entityId: taskId.toString(),
        action: decision === "REJECT" ? "REJECT_STAGE" : "CORRECTION_STAGE",
        userId: employeeId,
        correlationId,
        before: task,
        after: updated,
      });

      return updated;
    }

    const updated = await tx.designTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        outputRemark: input.outputRemark,
        completedAt: now,
        version: { increment: 1 },
      },
      include: {
        assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
        design: { select: { id: true, ideaRef: true, collectionName: true } },
        process: true,
        subProcess: true,
      },
    });

    await tx.designConcept.update({
      where: { id: task.designId },
      data: { currentStage: task.subProcess.code },
    });

    await unlockNextDependentTasks(
      tx,
      {
        id: task.id,
        designId: task.designId,
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
        subProcessCode: task.subProcess.code,
      },
      correlationId,
    );

    await promoteGatedWorkTasksAfterApproval(
      tx,
      {
        id: task.id,
        designId: task.designId,
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
      },
      employeeId,
      correlationId,
    );

    await writeAuditLog(tx, {
      entityType: "DesignTask",
      entityId: taskId.toString(),
      action: "APPROVE_STAGE",
      userId: employeeId,
      correlationId,
      before: task,
      after: updated,
    });

    return updated;
  });

  if (decision === "APPROVED") {
    await enqueueOutboxAndNotify(
      "TASK_COMPLETED",
      { taskId: taskId.toString(), designId: result.designId.toString() },
      correlationId,
    );
  } else {
    await enqueueOutboxAndNotify(
      "CORRECTION_RAISED",
      {
        designId: result.designId.toString(),
        taskId: taskId.toString(),
      },
      correlationId,
    );
  }

  return result;
}

async function reopenSampleCheckAfterResample(
  tx: Prisma.TransactionClient,
  designId: bigint,
  correlationId: string,
) {
  const sampleCheck = await tx.designTask.findFirst({
    where: { designId, subProcess: { code: "SAMPLE_CHECK" } },
    orderBy: { id: "desc" },
  });
  if (!sampleCheck) {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_NOT_READY,
      undefined,
      "Cannot reopen sample check after re-sample — SAMPLE_CHECK stage not found.",
    );
  }

  const { resolveEmployeeForRole } = await import("@/lib/services/assignment-service");
  let assigneeId = sampleCheck.assignedEmployeeId;
  if (!assigneeId && sampleCheck.assignedRoleId) {
    assigneeId = await resolveEmployeeForRole(sampleCheck.assignedRoleId);
  }

  await tx.designTask.update({
    where: { id: sampleCheck.id },
    data: {
      status: "ASSIGNED",
      assignedEmployeeId: assigneeId,
      completedAt: null,
      outputRemark: null,
      version: { increment: 1 },
    },
  });

  await tx.designConcept.update({
    where: { id: designId },
    data: { currentStage: "SAMPLE_CHECK", status: "ACTIVE" },
  });

  if (assigneeId != null) {
    await enqueueOutboxAndNotify(
      "TASK_ASSIGNED",
      { taskId: sampleCheck.id.toString(), employeeId: assigneeId },
      correlationId,
    );
  }
}

async function spawnResampleTask(
  tx: Prisma.TransactionClient,
  sourceTask: {
    designId: bigint;
    processId: number;
    assignedRoleId: number;
    priority: import("@prisma/client").Priority;
    expectedMinutes: number;
    dependencySequence: number | null;
    sequence: number;
  },
) {
  const resample = await tx.designSubProcessMaster.findFirst({
    where: { code: "RESAMPLE", active: true },
  });
  if (!resample) {
    throw businessRule(
      APP_ERROR_CODES.WORKFLOW_NOT_READY,
      undefined,
      "Re-sample workflow is not configured. Ask an admin to enable the RESAMPLE sub-process.",
    );
  }

  const { resolveEmployeeForRole } = await import("@/lib/services/assignment-service");
  const roleId = resample.defaultRoleId ?? sourceTask.assignedRoleId;
  const assigneeId = roleId ? await resolveEmployeeForRole(roleId) : null;
  const maxSeq = await tx.designTask.aggregate({
    where: { designId: sourceTask.designId },
    _max: { sequence: true },
  });
  const sequence = (maxSeq._max.sequence ?? 0) + 1;
  // Independent of SAMPLE_CHECK completion — costing must not unlock from this task.
  const dependencySequence = sourceTask.dependencySequence ?? sourceTask.sequence;

  const created = await tx.designTask.create({
    data: {
      designId: sourceTask.designId,
      processId: resample.processId,
      subProcessId: resample.id,
      assignedEmployeeId: assigneeId,
      assignedRoleId: roleId,
      status: initialStatusForCreate({ hasAssignee: !!assigneeId, isReady: true }),
      priority: sourceTask.priority,
      expectedMinutes: sourceTask.expectedMinutes,
      sequence,
      dependencySequence,
    },
  });

  if (assigneeId != null) {
    await enqueueOutboxAndNotify(
      "TASK_ASSIGNED",
      { taskId: created.id.toString(), employeeId: assigneeId },
      `resample-${sourceTask.designId.toString()}`,
    );
  }
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
    if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);

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
