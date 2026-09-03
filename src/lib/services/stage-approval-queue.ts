import { prisma } from "@/lib/db";
import { isTaskReady } from "@/lib/services/task-dependency";
import {
  canRoleActOnStageApproval,
  canRoleSeeStageApproval,
  filterStageApprovalsForRole,
  STAGE_APPROVAL_CODES,
} from "@/lib/stage-approval-rbac";
import { isStageApprovalActionable } from "@/lib/design-workflow";

import type { StageApprovalQueueItem } from "@/lib/types/api";

export type { StageApprovalQueueItem };

/** Include PENDING so ready-but-not-unlocked approvals appear (same as design detail). */
const OPEN_APPROVAL_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "RUNNING",
  "ON_HOLD",
  "CHECKING",
] as const;

/** Maps workflow approval sub-process codes to the work task they gate. */
export const WORK_CODE_BY_APPROVAL: Record<string, string> = {
  SKETCH_APPROVAL: "SKETCH",
  PUNCH_CHECK: "PUNCH",
  SAMPLE_CHECK: "MACHINE_SAMPLE",
  FINAL_APPROVAL: "COSTING",
  CONCEPT_REVIEW: "SKETCH",
  LIVE_REVIEW: "PROD_RELEASE",
};

export function workSubProcessCodeForApproval(approvalCode: string): string | null {
  return WORK_CODE_BY_APPROVAL[approvalCode] ?? null;
}

function relatedWorkTaskName(
  approvalCode: string,
  tasks: Array<{ subProcess: { code: string; name: string }; status: string }>,
): string | null {
  const workCode = workSubProcessCodeForApproval(approvalCode);
  if (!workCode) return null;
  const work = tasks.find((t) => t.subProcess.code === workCode);
  if (!work) return null;
  if (work.status === "CHECKING") return work.subProcess.name;
  if (
    (approvalCode === "FINAL_APPROVAL" || approvalCode === "LIVE_REVIEW") &&
    ["CHECKING", "COMPLETED"].includes(work.status)
  ) {
    return work.subProcess.name;
  }
  return null;
}

export function isStageApprovalVisibleToViewer(input: {
  roleCode?: string | null;
  approvalCode: string;
  assignedEmployeeId: number | null;
  viewerEmployeeId: number;
}): boolean {
  const { roleCode, approvalCode, assignedEmployeeId, viewerEmployeeId } = input;
  return canRoleSeeStageApproval(roleCode, approvalCode, {
    isAssignee: assignedEmployeeId === viewerEmployeeId,
    isUnassigned: assignedEmployeeId == null,
  });
}

/** Workflow stage approvals (Final Approval, Sketch Approval, etc.) — not the management chain. */
export async function listStageApprovalQueue(
  employeeId: number,
  roleCode?: string | null,
): Promise<StageApprovalQueueItem[]> {
  // Design Head / Checker / Management / Admin: org-wide candidates, then filter by owned codes.
  const ownerOversee =
    roleCode != null &&
    STAGE_APPROVAL_CODES.some((code) => canRoleActOnStageApproval(roleCode, code));

  const candidates = await prisma.designTask.findMany({
    where: {
      subProcess: { isApproval: true },
      status: { in: [...OPEN_APPROVAL_STATUSES] },
      ...(ownerOversee
        ? {}
        : {
            OR: [{ assignedEmployeeId: employeeId }, { assignedEmployeeId: null }],
          }),
    },
    orderBy: [{ dueAt: "asc" }, { sequence: "asc" }],
    include: {
      design: { select: { id: true, ideaRef: true, collectionName: true } },
      subProcess: { select: { name: true, code: true, isApproval: true } },
      assignedEmployee: { select: { name: true } },
    },
  });

  if (candidates.length === 0) return [];

  const designIds = [...new Set(candidates.map((t) => t.designId))];
  const allTasks = await prisma.designTask.findMany({
    where: { designId: { in: designIds } },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      designId: true,
      sequence: true,
      dependencySequence: true,
      status: true,
      subProcess: { select: { code: true, name: true } },
    },
  });

  const tasksByDesign = new Map<string, typeof allTasks>();
  for (const row of allTasks) {
    const key = row.designId.toString();
    const list = tasksByDesign.get(key) ?? [];
    list.push(row);
    tasksByDesign.set(key, list);
  }

  const queue: StageApprovalQueueItem[] = [];

  for (const task of candidates) {
    const designKey = task.designId.toString();
    const siblings = tasksByDesign.get(designKey) ?? [];
    const ready = isTaskReady(
      {
        id: task.id.toString(),
        dependencySequence: task.dependencySequence,
        sequence: task.sequence,
        status: task.status,
      },
      siblings,
    );
    if (!ready) continue;

    const workCode = workSubProcessCodeForApproval(task.subProcess.code);
    const linkedWork = workCode
      ? siblings.find((s) => s.subProcess.code === workCode)
      : undefined;
    if (!isStageApprovalActionable(task.subProcess.code, linkedWork)) continue;

    if (
      !isStageApprovalVisibleToViewer({
        roleCode,
        approvalCode: task.subProcess.code,
        assignedEmployeeId: task.assignedEmployeeId,
        viewerEmployeeId: employeeId,
      })
    ) {
      continue;
    }

    queue.push({
      taskId: task.id.toString(),
      designId: designKey,
      ideaRef: task.design.ideaRef,
      collectionName: task.design.collectionName,
      stageName: task.subProcess.name,
      stageCode: task.subProcess.code,
      status: task.status,
      assigneeName: task.assignedEmployee?.name ?? null,
      workStageName: relatedWorkTaskName(task.subProcess.code, siblings),
    });
  }

  return roleCode ? filterStageApprovalsForRole(roleCode, queue) : queue;
}
