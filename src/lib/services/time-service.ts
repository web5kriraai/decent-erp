import { prisma } from "@/lib/db";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { createAppError, notFound, conflict } from "@/lib/errors/create-app-error";
import { PERMISSIONS } from "@/lib/permissions";
import {
  computeTimeSummary,
  endOfUtcDay,
  startOfUtcDay,
  type TimeEventRecord,
} from "@/lib/services/time-calculation";
import { MY_TASKS_VISIBLE_STATUSES } from "@/lib/services/task-dependency";
import { buildBlockedContext } from "@/lib/services/action-center";
import { getTaskStartAvailability } from "@/lib/action-availability";
import { reconcileTaskReadiness } from "@/lib/services/task-readiness";
import {
  resolveEffectiveTaskStatus,
  type StageGateSibling,
} from "@/lib/services/workflow-stage-gate";

const taskTimeInclude = {
  design: { select: { id: true, ideaRef: true, collectionName: true } },
  process: { select: { id: true, name: true, code: true } },
  subProcess: { select: { id: true, name: true, code: true, isFileRequired: true, isApproval: true } },
  assignedEmployee: { select: { id: true, name: true, employeeCode: true } },
  timeEvents: {
    orderBy: { eventTimeUtc: "asc" as const },
    include: { holdReason: { select: { id: true, code: true, name: true, excludeFromActiveTime: true } } },
  },
};

function mapEvents(
  events: Array<{
    eventType: string;
    eventTimeUtc: Date;
    holdReasonId: number | null;
    holdReason: { code: string; name: string; excludeFromActiveTime: boolean } | null;
  }>,
): TimeEventRecord[] {
  return events.map((e) => ({
    eventType: e.eventType,
    eventTimeUtc: e.eventTimeUtc,
    holdReasonId: e.holdReasonId,
    holdReason: e.holdReason,
  }));
}

export async function getEmployeeTimeSummary(employeeId: number, date = new Date()) {
  const dayStart = startOfUtcDay(date);
  const dayEnd = endOfUtcDay(date);
  const now = new Date();

  const [tasks, workdayClosed, runningTask] = await Promise.all([
    prisma.designTask.findMany({
      where: {
        assignedEmployeeId: employeeId,
        timeEvents: { some: { eventTimeUtc: { gte: dayStart, lte: dayEnd } } },
      },
      include: {
        design: { select: { id: true, ideaRef: true } },
        subProcess: { select: { name: true } },
        timeEvents: {
          where: { eventTimeUtc: { gte: dayStart, lte: now } },
          orderBy: { eventTimeUtc: "asc" },
          include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
        },
      },
    }),
    prisma.workdaySession.findUnique({
      where: { employeeId_workDate: { employeeId, workDate: dayStart } },
    }),
    prisma.designTask.findFirst({
      where: { assignedEmployeeId: employeeId, status: { in: ["RUNNING", "ON_HOLD"] } },
      include: {
        design: { select: { ideaRef: true } },
        subProcess: { select: { name: true } },
        timeEvents: {
          orderBy: { eventTimeUtc: "asc" },
          include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
        },
      },
    }),
  ]);

  let totalActiveSeconds = 0;
  let totalHoldSeconds = 0;
  const holdReasonTotals = new Map<string, { name: string; seconds: number }>();

  const taskSummaries = tasks.map((task) => {
    const summary = computeTimeSummary(mapEvents(task.timeEvents), now);
    totalActiveSeconds += summary.activeSeconds;
    totalHoldSeconds += summary.holdSeconds;
    for (const h of summary.holdByReason) {
      const existing = holdReasonTotals.get(h.code) ?? { name: h.name, seconds: 0 };
      existing.seconds += h.seconds;
      holdReasonTotals.set(h.code, existing);
    }
    return {
      taskId: task.id.toString(),
      ideaRef: task.design.ideaRef,
      subProcessName: task.subProcess.name,
      status: task.status,
      expectedMinutes: task.expectedMinutes,
      ...summary,
    };
  });

  const overdueCount = await prisma.designTask.count({
    where: {
      assignedEmployeeId: employeeId,
      status: { in: [...MY_TASKS_VISIBLE_STATUSES] },
      dueAt: { lt: now },
    },
  });

  const openCount = await prisma.designTask.count({
    where: {
      assignedEmployeeId: employeeId,
      status: { in: [...MY_TASKS_VISIBLE_STATUSES] },
    },
  });

  return {
    date: dayStart.toISOString().slice(0, 10),
    workdayClosed: !!workdayClosed,
    workdayClosedAt: workdayClosed?.closedAtUtc.toISOString() ?? null,
    totals: {
      activeSeconds: totalActiveSeconds,
      holdSeconds: totalHoldSeconds,
      openTasks: openCount,
      overdueTasks: overdueCount,
      holdByReason: [...holdReasonTotals.entries()]
        .map(([code, { name, seconds }]) => ({ code, name, seconds }))
        .sort((a, b) => b.seconds - a.seconds),
    },
    currentTask: runningTask
      ? {
          taskId: runningTask.id.toString(),
          ideaRef: runningTask.design.ideaRef,
          subProcessName: runningTask.subProcess.name,
          status: runningTask.status,
          ...computeTimeSummary(mapEvents(runningTask.timeEvents), now),
        }
      : null,
    tasksToday: taskSummaries,
  };
}

export async function getLiveTeamTimeStatus() {
  const now = new Date();
  const activeTasks = await prisma.designTask.findMany({
    where: { status: { in: ["RUNNING", "ON_HOLD"] }, assignedEmployeeId: { not: null } },
    include: {
      design: { select: { ideaRef: true, collectionName: true } },
      process: { select: { name: true } },
      subProcess: { select: { name: true } },
      assignedEmployee: {
        select: { id: true, name: true, employeeCode: true, role: { select: { code: true, name: true } } },
      },
      timeEvents: {
        orderBy: { eventTimeUtc: "asc" },
        include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
      },
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });

  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      role: { select: { code: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const activeByEmployee = new Map(
    activeTasks.map((t) => [t.assignedEmployeeId!, t]),
  );

  return {
    asOfUtc: now.toISOString(),
    runningCount: activeTasks.filter((t) => t.status === "RUNNING").length,
    onHoldCount: activeTasks.filter((t) => t.status === "ON_HOLD").length,
    employees: employees.map((emp) => {
      const task = activeByEmployee.get(emp.id);
      if (!task) {
        return {
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          role: emp.role,
          status: "IDLE" as const,
          task: null,
        };
      }
      const summary = computeTimeSummary(mapEvents(task.timeEvents), now);
      return {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        role: emp.role,
        status: task.status as "RUNNING" | "ON_HOLD",
        task: {
          taskId: task.id.toString(),
          ideaRef: task.design.ideaRef,
          collectionName: task.design.collectionName,
          processName: task.process.name,
          subProcessName: task.subProcess.name,
          dueAt: task.dueAt?.toISOString() ?? null,
          expectedMinutes: task.expectedMinutes,
          ...summary,
        },
      };
    }),
  };
}

export async function getEmployeeTimeReport(from: Date, to: Date, employeeId?: number) {
  const rangeStart = startOfUtcDay(from);
  const rangeEnd = endOfUtcDay(to);
  const now = new Date();

  const employees = await prisma.employee.findMany({
    where: { active: true, ...(employeeId ? { id: employeeId } : {}) },
    select: {
      id: true,
      name: true,
      employeeCode: true,
      role: { select: { code: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    employees.map(async (emp) => {
      const events = await prisma.taskTimeEvent.findMany({
        where: {
          employeeId: emp.id,
          eventTimeUtc: { gte: rangeStart, lte: rangeEnd },
        },
        include: { holdReason: { select: { code: true, name: true, excludeFromActiveTime: true } } },
        orderBy: { eventTimeUtc: "asc" },
      });

      const summary = computeTimeSummary(mapEvents(events), now);
      const tasksWorked = new Set(events.map((e) => e.taskId.toString())).size;
      const completedInRange = await prisma.designTask.count({
        where: {
          assignedEmployeeId: emp.id,
          status: "COMPLETED",
          completedAt: { gte: rangeStart, lte: rangeEnd },
        },
      });

      const workdaysClosed = await prisma.workdaySession.count({
        where: {
          employeeId: emp.id,
          workDate: { gte: rangeStart, lte: rangeEnd },
        },
      });

      return {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        role: emp.role,
        tasksWorked,
        tasksCompleted: completedInRange,
        workdaysClosed,
        ...summary,
      };
    }),
  );

  return { from: rangeStart.toISOString().slice(0, 10), to: rangeEnd.toISOString().slice(0, 10), rows };
}

export async function getTaskTimeDetail(
  taskId: bigint,
  viewerEmployeeId: number,
  viewerPermissions: string[],
  correlationId = "task-detail",
) {
  if (viewerPermissions.includes(PERMISSIONS.TASK_EXECUTE)) {
    await reconcileTaskReadiness(taskId, viewerEmployeeId, correlationId);
  }

  const peek = await prisma.designTask.findUnique({
    where: { id: taskId },
    select: {
      designId: true,
      subProcess: { select: { code: true } },
    },
  });
  if (
    peek &&
    (peek.subProcess.code === "PROD_RELEASE" || peek.subProcess.code === "LIVE_REVIEW")
  ) {
    const { healStuckProdReleaseChecking } = await import(
      "@/lib/services/production-service"
    );
    await healStuckProdReleaseChecking(
      peek.designId,
      viewerEmployeeId,
      `${correlationId}-heal-prod-release`,
    );
  }

  const task = await prisma.designTask.findUnique({
    where: { id: taskId },
    include: taskTimeInclude,
  });

  if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);

  const isAssignee = task.assignedEmployeeId === viewerEmployeeId;
  const canViewTeam = viewerPermissions.includes(PERMISSIONS.TIME_VIEW_TEAM);

  if (!isAssignee && !canViewTeam) {
    throw createAppError(APP_ERROR_CODES.TASK_NOT_ASSIGNED, 403);
  }

  const peerTasks = await prisma.designTask.findMany({
    where: { designId: task.designId },
    orderBy: [{ sequence: "asc" }],
    select: {
      id: true,
      sequence: true,
      dependencySequence: true,
      status: true,
      assignedEmployeeId: true,
      subProcess: { select: { name: true, code: true, isApproval: true } },
      assignedEmployee: { select: { name: true } },
    },
  });

  const runningTask =
    isAssignee
      ? await prisma.designTask.findFirst({
          where: { assignedEmployeeId: viewerEmployeeId, status: "RUNNING" },
          select: { id: true },
        })
      : null;

  const now = new Date();
  const summary = computeTimeSummary(mapEvents(task.timeEvents), now);

  const stageSiblings: StageGateSibling[] = peerTasks.map((peer) => ({
    id: peer.id.toString(),
    dependencySequence: peer.dependencySequence,
    sequence: peer.sequence,
    status: peer.status,
    assignedEmployeeId: peer.assignedEmployeeId,
    subProcess: peer.subProcess,
    assignedEmployee: peer.assignedEmployee,
  }));

  const effectiveStatus = resolveEffectiveTaskStatus(
    {
      id: task.id.toString(),
      dependencySequence: task.dependencySequence,
      sequence: task.sequence,
      status: task.status,
      subProcess: task.subProcess,
    },
    stageSiblings,
  );

  const workflowPeers = peerTasks.map((peer) => ({
    id: peer.id.toString(),
    sequence: peer.sequence,
    dependencySequence: peer.dependencySequence,
    status: peer.status,
    assignedEmployeeId: peer.assignedEmployeeId,
    subProcess: peer.subProcess,
    assignedEmployee: peer.assignedEmployee,
  }));

  const taskRow = {
    id: task.id.toString(),
    status: task.status,
    dependencySequence: task.dependencySequence,
    sequence: task.sequence,
    assignedEmployeeId: task.assignedEmployeeId,
  };

  const startAvailability = isAssignee
    ? getTaskStartAvailability(taskRow, workflowPeers, {
        hasRunningTask: runningTask != null && runningTask.id !== task.id,
      })
    : { available: false as const };

  const blockedContext =
    isAssignee && !startAvailability.available && ["PENDING", "ASSIGNED"].includes(task.status)
      ? buildBlockedContext(taskRow, workflowPeers)
      : null;

  return {
    id: task.id.toString(),
    designId: task.designId.toString(),
    status: task.status,
    effectiveStatus,
    sequence: task.sequence,
    dependencySequence: task.dependencySequence,
    priority: task.priority,
    expectedMinutes: task.expectedMinutes,
    version: task.version,
    outputRemark: task.outputRemark,
    assignedEmployeeId: task.assignedEmployeeId,
    design: {
      id: task.design.id.toString(),
      ideaRef: task.design.ideaRef,
      collectionName: task.design.collectionName,
    },
    process: task.process,
    subProcess: task.subProcess,
    assignedEmployee: task.assignedEmployee,
    timeSummary: summary,
    timeline: task.timeEvents.map((e) => ({
      id: e.id.toString(),
      eventType: e.eventType,
      eventTimeUtc: e.eventTimeUtc.toISOString(),
      holdReason: e.holdReason,
      remark: e.remark,
      employeeId: e.employeeId,
    })),
    workflowPeers,
    assigneeHasRunningTask:
      runningTask != null && runningTask.id !== task.id,
    canStart: startAvailability.available,
    startBlockedReason: startAvailability.reason,
    blockedMessage: blockedContext?.blockedMessage ?? null,
  };
}

export async function persistWorkdayClose(employeeId: number, correlationId: string) {
  const running = await prisma.designTask.findFirst({
    where: { assignedEmployeeId: employeeId, status: "RUNNING" },
  });
  if (running) {
    throw conflict(APP_ERROR_CODES.TASK_ALREADY_RUNNING, {
      taskId: running.id.toString(),
    }, "End your running task before closing the workday.");
  }

  const now = new Date();
  const workDate = startOfUtcDay(now);

  const session = await prisma.workdaySession.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    update: { closedAtUtc: now, createdById: employeeId },
    create: { employeeId, workDate, closedAtUtc: now, createdById: employeeId },
  });

  // Stamp OFFICE_CLOSE on any ON_HOLD task timeline for audit (append-only)
  const onHoldTasks = await prisma.designTask.findMany({
    where: { assignedEmployeeId: employeeId, status: "ON_HOLD" },
    select: { id: true },
  });
  if (onHoldTasks.length > 0) {
    await prisma.taskTimeEvent.createMany({
      data: onHoldTasks.map((t) => ({
        taskId: t.id,
        employeeId,
        eventType: "OFFICE_CLOSE" as const,
        eventTimeUtc: now,
        createdById: employeeId,
        remark: "Workday closed",
      })),
    });
  }

  return {
    closed: true,
    employeeId,
    workDate: workDate.toISOString().slice(0, 10),
    closedAtUtc: session.closedAtUtc.toISOString(),
    correlationId,
  };
}
