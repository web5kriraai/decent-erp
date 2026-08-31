import type { Prisma, Priority } from "@prisma/client";
import { resolveEmployeesForRoles } from "@/lib/services/assignment-service";

type PatternTaskRow = {
  processId: number;
  subProcessId: number;
  defaultRoleId: number;
  expectedMinutes: number;
  priority: Priority;
  sequence: number;
  dayOffset: number;
  dependencySequence: number | null;
};

export type TaskCreateRow = {
  designId: bigint;
  processId: number;
  subProcessId: number;
  assignedEmployeeId?: number;
  assignedRoleId: number;
  expectedMinutes: number;
  priority: Priority;
  status: "PENDING" | "ASSIGNED";
  sequence: number;
  dependencySequence?: number | null;
  plannedStart?: Date;
  dueAt?: Date;
};

function addWorkingDays(base: Date, dayOffset: number): Date {
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + dayOffset);
  return result;
}

export async function buildTasksFromPatternTasks(
  designId: bigint,
  patternTasks: PatternTaskRow[],
  options?: { baseDate?: Date; firstAssigneeId?: number },
): Promise<TaskCreateRow[]> {
  const base = options?.baseDate ?? new Date();
  const roleMap = await resolveEmployeesForRoles(patternTasks.map((p) => p.defaultRoleId));

  return patternTasks.map((pt, index) => {
    const plannedStart = addWorkingDays(base, pt.dayOffset);
    const dueAt = new Date(plannedStart.getTime() + pt.expectedMinutes * 60_000);
    const resolvedEmployee = roleMap.get(pt.defaultRoleId) ?? undefined;
    const isFirst = index === 0;
    const assignee = isFirst && options?.firstAssigneeId ? options.firstAssigneeId : resolvedEmployee;

    return {
      designId,
      processId: pt.processId,
      subProcessId: pt.subProcessId,
      assignedRoleId: pt.defaultRoleId,
      assignedEmployeeId: assignee,
      expectedMinutes: pt.expectedMinutes,
      priority: pt.priority,
      sequence: pt.sequence,
      dependencySequence: pt.dependencySequence,
      plannedStart,
      dueAt,
      status: assignee ? "ASSIGNED" : "PENDING",
    };
  });
}

export async function createDesignProcessInstances(
  tx: Prisma.TransactionClient,
  designId: bigint,
  tasks: TaskCreateRow[],
) {
  const byProcess = new Map<number, TaskCreateRow[]>();
  for (const task of tasks) {
    const list = byProcess.get(task.processId) ?? [];
    list.push(task);
    byProcess.set(task.processId, list);
  }

  let processSeq = 1;
  for (const [processId, processTasks] of byProcess) {
    const plannedStarts = processTasks.map((t) => t.plannedStart).filter(Boolean) as Date[];
    const dueDates = processTasks.map((t) => t.dueAt).filter(Boolean) as Date[];
    const designProcess = await tx.designProcess.create({
      data: {
        designId,
        processId,
        sequence: processSeq++,
        status: "PENDING",
        plannedStart: plannedStarts.length ? new Date(Math.min(...plannedStarts.map((d) => d.getTime()))) : null,
        plannedEnd: dueDates.length ? new Date(Math.max(...dueDates.map((d) => d.getTime()))) : null,
      },
    });

    let subSeq = 1;
    for (const task of processTasks.sort((a, b) => a.sequence - b.sequence)) {
      await tx.designSubProcess.create({
        data: {
          designProcessId: designProcess.id,
          subProcessId: task.subProcessId,
          sequence: subSeq++,
          status: "PENDING",
        },
      });
    }
  }
}

export async function createDesignComponents(
  tx: Prisma.TransactionClient,
  designId: bigint,
  componentTypeIds: number[],
) {
  if (!componentTypeIds.length) return;
  await tx.designComponent.createMany({
    data: componentTypeIds.map((componentTypeId, index) => ({
      designId,
      componentTypeId,
      sequence: index + 1,
    })),
  });
}

export function generateDesignNumber(ideaRef: string): string {
  const suffix = ideaRef.replace(/^IDEA-/, "").slice(-8);
  return `DN-${suffix}`;
}
