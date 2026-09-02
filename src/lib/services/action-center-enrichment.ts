import { getTaskStartAvailability } from "@/lib/action-availability";
import type { DepSibling } from "@/lib/services/action-center";
import { findNextOpenTask } from "@/lib/services/action-center";
import { findStageApprovalGate, resolveEffectiveTaskStatus } from "@/lib/services/workflow-stage-gate";
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

export type ActionCenterHistoricalEnrichment = {
  effectiveStatus: string;
  isWaitingOnOthers: boolean;
  waitingOnStage: string | null;
  waitingOnAssignee: string | null;
};

export function enrichActionCenterHistoricalList<T extends EnrichableTask>(
  tasks: T[],
  siblingsByDesign: Map<string, DepSibling[]>,
): Array<T & ActionCenterHistoricalEnrichment> {
  return tasks.map((task) => {
    const siblings = siblingsByDesign.get(task.designId.toString()) ?? [];
    const gateTask = {
      id: task.id.toString(),
      dependencySequence: task.dependencySequence,
      sequence: task.sequence,
      status: task.status,
      subProcess: task.subProcess,
    };
    const effectiveStatus = resolveEffectiveTaskStatus(gateTask, siblings);
    const approvalGate =
      task.status === "CHECKING" && !task.subProcess.isApproval
        ? findStageApprovalGate(gateTask, siblings)
        : null;
    const nextOpen =
      effectiveStatus === "COMPLETED" ? findNextOpenTask(siblings, task.sequence) : null;
    const pipelineContinues =
      nextOpen != null && nextOpen.status !== "COMPLETED" && nextOpen.status !== "CANCELLED";

    return {
      ...task,
      effectiveStatus,
      isWaitingOnOthers: approvalGate != null || pipelineContinues,
      waitingOnStage: approvalGate?.subProcess?.name ?? null,
      waitingOnAssignee: approvalGate?.assignedEmployee?.name ?? null,
    };
  });
}
