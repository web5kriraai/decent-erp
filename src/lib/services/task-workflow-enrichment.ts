import { prisma } from "@/lib/db";
import { findStageApprovalGate, resolveEffectiveTaskStatus } from "@/lib/services/workflow-stage-gate";
import type { StageGateSibling } from "@/lib/services/workflow-stage-gate";

type EnrichableTask = {
  id: bigint;
  designId: bigint;
  status: string;
  sequence: number;
  dependencySequence: number | null;
  assignedEmployeeId: number | null;
  subProcess: {
    code: string;
    name: string;
    isApproval: boolean;
    isFileRequired?: boolean;
  };
  design: { id: bigint; ideaRef: string; collectionName: string };
  process: { id: number; name: string; code: string };
  assignedEmployee?: { id: number; name: string; employeeCode: string } | null;
  timeEvents?: unknown[];
  [key: string]: unknown;
};

export type EnrichedDesignTask = EnrichableTask & {
  effectiveStatus: string;
  isWaitingOnOthers: boolean;
  waitingOnStage: string | null;
  waitingOnAssignee: string | null;
};

function toSibling(row: {
  id: bigint;
  sequence: number;
  dependencySequence: number | null;
  status: string;
  assignedEmployeeId: number | null;
  subProcess: { name: string; code: string; isApproval: boolean };
  assignedEmployee?: { name: string } | null;
}): StageGateSibling {
  return {
    id: row.id.toString(),
    dependencySequence: row.dependencySequence,
    sequence: row.sequence,
    status: row.status,
    assignedEmployeeId: row.assignedEmployeeId,
    subProcess: row.subProcess,
    assignedEmployee: row.assignedEmployee ?? null,
  };
}

export async function enrichEmployeeTasks<T extends EnrichableTask>(
  tasks: T[],
): Promise<Array<T & Omit<EnrichedDesignTask, keyof EnrichableTask>>> {
  if (tasks.length === 0) return [];

  const designIds = [...new Set(tasks.map((t) => t.designId.toString()))];
  const siblingRows = await prisma.designTask.findMany({
    where: { designId: { in: designIds.map((id) => BigInt(id)) } },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      designId: true,
      sequence: true,
      dependencySequence: true,
      status: true,
      assignedEmployeeId: true,
      subProcess: { select: { name: true, code: true, isApproval: true } },
      assignedEmployee: { select: { name: true } },
    },
  });

  const siblingsByDesign = new Map<string, StageGateSibling[]>();
  for (const row of siblingRows) {
    const key = row.designId.toString();
    const list = siblingsByDesign.get(key) ?? [];
    list.push(toSibling(row));
    siblingsByDesign.set(key, list);
  }

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
        ? findStageApprovalGate(
            {
              id: task.id.toString(),
              dependencySequence: task.dependencySequence,
              sequence: task.sequence,
              subProcess: task.subProcess,
            },
            siblings,
          )
        : null;

    return {
      ...task,
      effectiveStatus,
      isWaitingOnOthers: approvalGate != null,
      waitingOnStage: approvalGate?.subProcess?.name ?? null,
      waitingOnAssignee: approvalGate?.assignedEmployee?.name ?? null,
    };
  });
}
