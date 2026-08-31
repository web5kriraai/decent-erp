import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  computeTimeSummary,
  endOfUtcDay,
  startOfUtcDay,
  type TimeEventRecord,
} from "@/lib/services/time-calculation";

const taskTimeInclude = {
  design: { select: { id: true, ideaRef: true, collectionName: true } },
  process: { select: { id: true, name: true, code: true } },
  subProcess: { select: { id: true, name: true, code: true, isFileRequired: true } },
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
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      dueAt: { lt: now },
    },
  });

  const openCount = await prisma.designTask.count({
    where: {
      assignedEmployeeId: employeeId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
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
) {
  const task = await prisma.designTask.findUnique({
    where: { id: taskId },
    include: taskTimeInclude,
  });

  if (!task) throw new ApiError("Task not found", 404);

  const isAssignee = task.assignedEmployeeId === viewerEmployeeId;
  const canViewTeam = viewerPermissions.includes(PERMISSIONS.TIME_VIEW_TEAM);

  if (!isAssignee && !canViewTeam) {
    throw new ApiError("Permission denied", 403);
  }

  const now = new Date();
  const summary = computeTimeSummary(mapEvents(task.timeEvents), now);

  return {
    id: task.id.toString(),
    designId: task.designId.toString(),
    status: task.status,
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
  };
}

export async function persistWorkdayClose(employeeId: number, correlationId: string) {
  const running = await prisma.designTask.findFirst({
    where: { assignedEmployeeId: employeeId, status: "RUNNING" },
  });
  if (running) {
    throw new ApiError("Cannot close workday while a task is running", 409, {
      taskId: running.id.toString(),
    });
  }

  const now = new Date();
  const workDate = startOfUtcDay(now);

  const session = await prisma.workdaySession.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    update: { closedAtUtc: now, createdById: employeeId },
    create: { employeeId, workDate, closedAtUtc: now, createdById: employeeId },
  });

  return {
    closed: true,
    employeeId,
    workDate: workDate.toISOString().slice(0, 10),
    closedAtUtc: session.closedAtUtc.toISOString(),
    correlationId,
  };
}
