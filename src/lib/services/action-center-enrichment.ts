import { getTaskStartAvailability } from "@/lib/action-availability";
import type { DepSibling } from "@/lib/services/action-center";
import { sortTasksByEffectivePriority } from "@/lib/task-priority";

type EnrichableTask = {
  id: bigint;
  designId: bigint;
  status: string;
  dependencySequence: number | null;
  sequence: number;
  assignedEmployeeId: number | null;
  priority: string;
  dueAt?: Date | null;
  design: { id: bigint; ideaRef: string; collectionName: string; priority?: string };
  subProcess: { name: string; code: string; isApproval: boolean };
};

export type ActionCenterTaskEnrichment = {
  canStart: boolean;
  startBlockedReason?: string;
};

export function enrichActionCenterTaskList<T extends EnrichableTask>(
  tasks: T[],
  siblingsByDesign: Map<string, DepSibling[]>,
  runningTaskId: bigint | null,
): Array<T & ActionCenterTaskEnrichment> {
  const enriched = tasks.map((task) => {
    const siblings = siblingsByDesign.get(task.designId.toString()) ?? [];
    const row = {
      id: task.id.toString(),
      status: task.status,
      dependencySequence: task.dependencySequence,
      sequence: task.sequence,
      assignedEmployeeId: task.assignedEmployeeId,
    };
    const availability = getTaskStartAvailability(row, siblings, {
      hasRunningTask: runningTaskId != null && runningTaskId !== task.id,
    });
    return {
      ...task,
      canStart: availability.available,
      startBlockedReason: availability.reason,
    };
  });

  return sortTasksByEffectivePriority(enriched);
}
