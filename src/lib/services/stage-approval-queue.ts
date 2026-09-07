import { prisma } from "@/lib/db";
import { isTaskReady } from "@/lib/services/task-dependency";
import {
  canRoleActOnStageApproval,
  canRoleSeeStageApproval,
  filterStageApprovalsForRole,
} from "@/lib/stage-approval-rbac";
import {
  isStageApprovalActionableFromBehavior,
  resolveStageBehavior,
  workPrecursorCodeForApproval,
} from "@/lib/workflow/stage-behavior";
import { ROLE_CODES } from "@/lib/permissions";
import { TEXTILE_APPROVAL_OWNER_ROLE } from "@/lib/workflow/stage-capabilities";

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

/**
 * @deprecated Prefer workPrecursorCodeForApproval / resolveStageBehavior.
 * Kept for parity tests and legacy call sites.
 */
export const WORK_CODE_BY_APPROVAL: Record<string, string> = {
  SKETCH_APPROVAL: "SKETCH",
  PUNCH_CHECK: "PUNCH",
  SAMPLE_CHECK: "MACHINE_SAMPLE",
  FINAL_APPROVAL: "COSTING",
  CONCEPT_REVIEW: "SKETCH",
  LIVE_REVIEW: "PROD_RELEASE",
};

export function workSubProcessCodeForApproval(
  approvalCode: string,
  capabilities?: unknown,
): string | null {
  const fromCaps = workPrecursorCodeForApproval(approvalCode, capabilities);
  if (fromCaps) return fromCaps;
  // Legacy CONCEPT_REVIEW mapped to SKETCH for related-work display only.
  if (approvalCode === "CONCEPT_REVIEW") return WORK_CODE_BY_APPROVAL.CONCEPT_REVIEW;
  return WORK_CODE_BY_APPROVAL[approvalCode] ?? null;
}

/** Prior execute stage typically feeding this stage (for handoff banners). */
export const PRIOR_CODE_BY_STAGE: Record<string, string> = {
  SKETCH: "CONCEPT_REVIEW",
  SKETCH_APPROVAL: "SKETCH",
  PUNCH: "SKETCH_APPROVAL",
  PUNCH_CHECK: "PUNCH",
  MAT_REQ: "PUNCH_CHECK",
  FABRIC_ISSUE: "MAT_REQ",
  MACHINE_SAMPLE: "FABRIC_ISSUE",
  SAMPLE_RECEIVE: "MACHINE_SAMPLE",
  SAMPLE_CHECK: "MACHINE_SAMPLE",
  COSTING: "SAMPLE_CHECK",
  FINAL_APPROVAL: "COSTING",
  PROD_HANDOFF: "FINAL_APPROVAL",
  PROD_INSTRUCTION: "PROD_HANDOFF",
  PROD_RELEASE: "PROD_INSTRUCTION",
  LIVE_REVIEW: "PROD_RELEASE",
};

export function priorSubProcessCodeForStage(stageCode: string): string | null {
  const behavior = resolveStageBehavior({ code: stageCode });
  if (behavior.autoAdvanceOnCreate) return null;
  if (PRIOR_CODE_BY_STAGE[stageCode]) return PRIOR_CODE_BY_STAGE[stageCode];
  return behavior.workPrecursorCode;
}

export type PeerTaskForHandoff = {
  status: string;
  outputRemark?: string | null;
  assignedEmployee?: { name?: string | null } | null;
  subProcess: { code: string; name: string };
  fileCount?: number | null;
};

export function findPriorPeerForHandoff(
  stageCode: string,
  peers?: PeerTaskForHandoff[] | null,
): PeerTaskForHandoff | null {
  if (!peers?.length) return null;
  const priorCode = priorSubProcessCodeForStage(stageCode);
  if (!priorCode) return null;
  return peers.find((p) => p.subProcess.code === priorCode) ?? null;
}

function relatedWorkTaskName(
  approvalCode: string,
  tasks: Array<{ subProcess: { code: string; name: string }; status: string }>,
  capabilities?: unknown,
): string | null {
  const behavior = resolveStageBehavior({ code: approvalCode, capabilities });
  const workCode = behavior.workPrecursorCode ?? workSubProcessCodeForApproval(approvalCode, capabilities);
  if (!workCode) return null;
  const work = tasks.find((t) => t.subProcess.code === workCode);
  if (!work) return null;
  if (isStageApprovalActionableFromBehavior(behavior, work)) return work.subProcess.name;
  return null;
}

export function isStageApprovalVisibleToViewer(input: {
  roleCode?: string | null;
  approvalCode: string;
  assignedEmployeeId: number | null;
  viewerEmployeeId: number;
  ownerRoleCode?: string | null;
  capabilities?: unknown;
}): boolean {
  const {
    roleCode,
    approvalCode,
    assignedEmployeeId,
    viewerEmployeeId,
    ownerRoleCode,
    capabilities,
  } = input;
  return canRoleSeeStageApproval(roleCode, approvalCode, {
    isAssignee: assignedEmployeeId === viewerEmployeeId,
    isUnassigned: assignedEmployeeId == null,
    ownerRoleCode,
    capabilities,
  });
}

async function roleOwnsApprovalStages(roleCode: string): Promise<boolean> {
  if (roleCode === ROLE_CODES.ADMIN) return true;
  if (Object.values(TEXTILE_APPROVAL_OWNER_ROLE).includes(roleCode)) return true;
  const count = await prisma.designSubProcessMaster.count({
    where: {
      isApproval: true,
      active: true,
      defaultRole: { code: roleCode },
    },
  });
  return count > 0;
}

/** Workflow stage approvals — not the management chain. */
export async function listStageApprovalQueue(
  employeeId: number,
  roleCode?: string | null,
): Promise<StageApprovalQueueItem[]> {
  const ownerOversee = roleCode != null && (await roleOwnsApprovalStages(roleCode));

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
      subProcess: {
        select: {
          name: true,
          code: true,
          isApproval: true,
          capabilities: true,
          defaultRole: { select: { code: true } },
        },
      },
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
      subProcess: { select: { code: true, name: true, capabilities: true } },
    },
  });

  const tasksByDesign = new Map<string, typeof allTasks>();
  for (const row of allTasks) {
    const key = row.designId.toString();
    const list = tasksByDesign.get(key) ?? [];
    list.push(row);
    tasksByDesign.set(key, list);
  }

  const queue: Array<StageApprovalQueueItem & { ownerRoleCode?: string | null }> = [];

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

    const ownerRoleCode = task.subProcess.defaultRole?.code ?? null;
    const behavior = resolveStageBehavior({
      code: task.subProcess.code,
      capabilities: task.subProcess.capabilities,
      defaultRoleCode: ownerRoleCode,
    });

    const workCode = behavior.workPrecursorCode;
    const linkedWork = workCode
      ? siblings.find((s) => s.subProcess.code === workCode)
      : undefined;
    if (!isStageApprovalActionableFromBehavior(behavior, linkedWork)) continue;

    if (
      !isStageApprovalVisibleToViewer({
        roleCode,
        approvalCode: task.subProcess.code,
        assignedEmployeeId: task.assignedEmployeeId,
        viewerEmployeeId: employeeId,
        ownerRoleCode,
        capabilities: task.subProcess.capabilities,
      })
    ) {
      continue;
    }

    if (
      roleCode &&
      !canRoleActOnStageApproval(roleCode, task.subProcess.code, {
        ownerRoleCode,
        capabilities: task.subProcess.capabilities,
      }) &&
      task.assignedEmployeeId !== employeeId &&
      task.assignedEmployeeId != null
    ) {
      // Non-owners only see their own / unassigned (already filtered by visibility).
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
      workStageName: relatedWorkTaskName(
        task.subProcess.code,
        siblings,
        task.subProcess.capabilities,
      ),
      ownerRoleCode,
    });
  }

  return roleCode ? filterStageApprovalsForRole(roleCode, queue) : queue;
}
