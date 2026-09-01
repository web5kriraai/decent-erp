import { prisma } from "@/lib/db";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { notFound } from "@/lib/errors/create-app-error";
import { computeTimeSummary } from "@/lib/services/time-calculation";
import {
  countTerminalPhases,
  isDesignWorkflowComplete,
} from "@/lib/services/workflow-override-utils";
import { aggregateCompletionTotals } from "@/lib/services/design-summary-utils";

function mapEvents(
  events: Array<{
    eventType: string;
    eventTimeUtc: Date;
    holdReasonId: number | null;
    holdReason: {
      code: string;
      name: string;
      excludeFromActiveTime: boolean;
    } | null;
  }>,
) {
  return events.map((e) => ({
    eventType: e.eventType,
    eventTimeUtc: e.eventTimeUtc,
    holdReasonId: e.holdReasonId,
    holdReason: e.holdReason,
  }));
}

export async function getDesignCompletionSummary(designId: bigint) {
  const design = await prisma.designConcept.findUnique({
    where: { id: designId },
    select: {
      id: true,
      ideaRef: true,
      collectionName: true,
      status: true,
      createdAtUtc: true,
      tasks: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          status: true,
          sequence: true,
          expectedMinutes: true,
          startedAt: true,
          completedAt: true,
          skipReason: true,
          assignedEmployeeId: true,
          assignedEmployee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
              role: { select: { code: true, name: true } },
            },
          },
          subProcess: { select: { code: true, name: true } },
          timeEvents: {
            orderBy: { eventTimeUtc: "asc" },
            select: {
              employeeId: true,
              eventType: true,
              eventTimeUtc: true,
              holdReasonId: true,
              holdReason: {
                select: { code: true, name: true, excludeFromActiveTime: true },
              },
            },
          },
        },
      },
    },
  });

  if (!design) throw notFound(APP_ERROR_CODES.DESIGN_NOT_FOUND);

  const tasks = design.tasks;
  const isComplete = isDesignWorkflowComplete(tasks);
  const phaseCounts = countTerminalPhases(tasks);

  const allEvents = tasks.flatMap((t) => t.timeEvents);
  allEvents.sort((a, b) => a.eventTimeUtc.getTime() - b.eventTimeUtc.getTime());

  const workflowStartedAt =
    allEvents.find((e) => e.eventType === "START")?.eventTimeUtc ?? design.createdAtUtc;
  const workflowFinishedAt = isComplete
    ? allEvents.filter((e) => e.eventType === "END").at(-1)?.eventTimeUtc ?? null
    : null;

  type EmployeeRow = {
    employeeId: number;
    name: string;
    employeeCode: string;
    roleCode: string;
    roleName: string;
    tasksAssigned: number;
    tasksCompleted: number;
    tasksSkippedAsAssignee: number;
    activeSeconds: number;
    holdSeconds: number;
    totalElapsedSeconds: number;
  };

  const employeeMap = new Map<number, EmployeeRow>();

  const employeeIds = new Set<number>();
  for (const task of tasks) {
    if (task.assignedEmployeeId != null) employeeIds.add(task.assignedEmployeeId);
    for (const event of task.timeEvents) employeeIds.add(event.employeeId);
  }

  if (employeeIds.size > 0) {
    const employeeRows = await prisma.employee.findMany({
      where: { id: { in: [...employeeIds] } },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        role: { select: { code: true, name: true } },
      },
    });
    for (const emp of employeeRows) {
      employeeMap.set(emp.id, {
        employeeId: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
        roleCode: emp.role.code,
        roleName: emp.role.name,
        tasksAssigned: 0,
        tasksCompleted: 0,
        tasksSkippedAsAssignee: 0,
        activeSeconds: 0,
        holdSeconds: 0,
        totalElapsedSeconds: 0,
      });
    }
  }

  function getEmployeeRow(employeeId: number): EmployeeRow | null {
    return employeeMap.get(employeeId) ?? null;
  }

  for (const task of tasks) {
    if (task.assignedEmployeeId != null) {
      const row = getEmployeeRow(task.assignedEmployeeId);
      if (row) {
        row.tasksAssigned += 1;
        if (task.status === "COMPLETED") row.tasksCompleted += 1;
        if (task.status === "SKIPPED") row.tasksSkippedAsAssignee += 1;
      }
    }

    const eventsByEmployee = new Map<number, typeof task.timeEvents>();
    for (const event of task.timeEvents) {
      const list = eventsByEmployee.get(event.employeeId) ?? [];
      list.push(event);
      eventsByEmployee.set(event.employeeId, list);
    }

    for (const [employeeId, events] of eventsByEmployee) {
      const row = getEmployeeRow(employeeId);
      if (!row) continue;
      const summary = computeTimeSummary(mapEvents(events));
      row.activeSeconds += summary.activeSeconds;
      row.holdSeconds += summary.holdSeconds;
      row.totalElapsedSeconds += summary.totalElapsedSeconds;
    }
  }

  const employees = [...employeeMap.values()]
    .filter(
      (e) =>
        e.tasksAssigned > 0 ||
        e.activeSeconds > 0 ||
        e.tasksCompleted > 0 ||
        e.tasksSkippedAsAssignee > 0,
    )
    .sort((a, b) => b.activeSeconds - a.activeSeconds);

  const phases = tasks.map((task) => {
    const summary = computeTimeSummary(mapEvents(task.timeEvents));
    return {
      taskId: task.id.toString(),
      sequence: task.sequence,
      code: task.subProcess.code,
      name: task.subProcess.name,
      status: task.status,
      assignee: task.assignedEmployee
        ? {
            id: task.assignedEmployee.id,
            name: task.assignedEmployee.name,
            employeeCode: task.assignedEmployee.employeeCode,
          }
        : null,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      activeSeconds: summary.activeSeconds,
      holdSeconds: summary.holdSeconds,
      totalElapsedSeconds: summary.totalElapsedSeconds,
      expectedMinutes: task.expectedMinutes,
      skipReason: task.skipReason,
    };
  });

  const overrideLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "DesignConcept",
      entityId: designId.toString(),
      action: { in: ["WORKFLOW_SEND_QC", "WORKFLOW_BYPASS"] },
    },
    orderBy: { atUtc: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });

  const overrideHistory = overrideLogs.map((log) => {
    const after = (log.afterJson ?? {}) as Record<string, unknown>;
    const before = (log.beforeJson ?? {}) as Record<string, unknown>;
    return {
      action: log.action,
      atUtc: log.atUtc.toISOString(),
      actor: log.user.name,
      fromStage: (before.currentStage as string | null) ?? null,
      toStage: (after.targetCode as string | null) ?? null,
      reason: (after.reason as string | null) ?? null,
      direction: (after.direction as string | undefined) ?? undefined,
    };
  });

  const totals = {
    ...aggregateCompletionTotals(employees),
    skippedPhaseCount: phaseCounts.skipped,
  };

  return {
    designId: design.id.toString(),
    ideaRef: design.ideaRef,
    collectionName: design.collectionName,
    status: design.status,
    isComplete,
    workflowStartedAt: workflowStartedAt.toISOString(),
    workflowFinishedAt: workflowFinishedAt?.toISOString() ?? null,
    phaseCounts,
    employees,
    phases,
    overrideHistory,
    totals,
  };
}
