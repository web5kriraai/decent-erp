import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { resolveAssigneesForPatternTasks } from "@/lib/services/assignment-service";
import {
  addUtcDays,
  effectiveDayOffset,
  expectedMinutesToHoursLabel,
  formatPlannedDateLabel,
  plannedDueAt,
  type TaskDateMode,
  type WorkflowPreviewRow,
} from "@/lib/services/task-date-mode";
import type { Priority } from "@prisma/client";

export async function previewWorkflowPattern(
  workflowPatternId: number,
  options?: {
    taskDateMode?: TaskDateMode;
    designPriority?: Priority;
    firstAssigneeId?: number;
    baseDate?: Date;
  },
): Promise<{
  patternId: number;
  patternName: string;
  taskDateMode: TaskDateMode;
  tasks: WorkflowPreviewRow[];
}> {
  const pattern = await prisma.workflowPattern.findUnique({
    where: { id: workflowPatternId },
    include: {
      tasks: {
        orderBy: { sequence: "asc" },
        include: {
          process: { select: { id: true, name: true } },
          subProcess: { select: { id: true, name: true } },
          defaultRole: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!pattern || !pattern.active) {
    throw new ApiError("Workflow pattern not found", 404);
  }

  const mode = options?.taskDateMode ?? "SEQUENTIAL";
  const base = options?.baseDate ?? new Date();
  const designPriority = options?.designPriority ?? "MEDIUM";

  const assigneeIds = await resolveAssigneesForPatternTasks(
    pattern.tasks.map((pt) => ({
      defaultRoleId: pt.defaultRoleId,
      defaultSkillId: pt.defaultSkillId ?? null,
    })),
  );

  const uniqueIds = [...new Set(assigneeIds.filter((id): id is number => id != null))];
  const employees =
    uniqueIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: uniqueIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameById = new Map(employees.map((e) => [e.id, e.name]));

  const tasks: WorkflowPreviewRow[] = pattern.tasks.map((pt, index) => {
    const dayOffset = effectiveDayOffset(mode, pt.dayOffset ?? 0, index);
    const plannedStart = addUtcDays(base, dayOffset);
    const dueAt = plannedDueAt(plannedStart, pt.expectedMinutes);
    const resolvedId =
      index === 0 && options?.firstAssigneeId
        ? options.firstAssigneeId
        : assigneeIds[index] ?? null;
    const roleName = pt.defaultRole?.name ?? null;
    const assigneeName =
      (resolvedId != null ? nameById.get(resolvedId) : undefined) ??
      roleName ??
      "Unassigned";

    return {
      sequence: pt.sequence,
      processId: pt.processId,
      subProcessId: pt.subProcessId,
      stage: pt.subProcess?.name ?? `Step ${pt.sequence}`,
      assigneeName,
      assignedEmployeeId: resolvedId,
      roleName,
      hours: expectedMinutesToHoursLabel(pt.expectedMinutes),
      expectedMinutes: pt.expectedMinutes,
      plannedDate: formatPlannedDateLabel(base, dayOffset),
      plannedStart: plannedStart.toISOString(),
      dueAt: dueAt.toISOString(),
      priority: (pt.priority ?? designPriority) as Priority,
    };
  });

  return {
    patternId: pattern.id,
    patternName: pattern.name,
    taskDateMode: mode,
    tasks,
  };
}
