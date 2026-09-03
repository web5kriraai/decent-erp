import { PERMISSIONS, ROLE_CODES } from "@/lib/permissions";
import { PRODUCTION_POST_APPROVAL_CODES } from "@/lib/services/production-workflow";

/** Ladder stages shown on Production Desk (excludes LIVE_REVIEW). */
export const PRODUCTION_DESK_LADDER_CODES = [
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
] as const;

export type ProductionDeskLadderCode = (typeof PRODUCTION_DESK_LADDER_CODES)[number];

export const PRODUCTION_DESK_STAGE_LABELS: Record<ProductionDeskLadderCode, string> = {
  PROD_HANDOFF: "Handoff",
  PROD_INSTRUCTION: "Instruction",
  PROD_RELEASE: "Release",
};

/** Default owning role for each desk ladder stage (matches ladder seed). */
export const PRODUCTION_DESK_STAGE_OWNER_ROLE: Record<ProductionDeskLadderCode, string> = {
  PROD_HANDOFF: ROLE_CODES.DESIGN_HEAD,
  PROD_INSTRUCTION: ROLE_CODES.PRODUCTION_HEAD,
  PROD_RELEASE: ROLE_CODES.PRODUCTION_HEAD,
};

const DONE_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

export type ProductionLadderTaskInput = {
  id: bigint | string | number;
  status: string;
  subProcess: { code: string } | null;
  assignedEmployeeId?: number | null;
  assignedEmployee?: { name: string } | null;
};

export type ProductionLadderStageSnapshot = {
  code: ProductionDeskLadderCode;
  taskId: string | null;
  status: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
};

export type ProductionDeskNextAction = {
  code: ProductionDeskLadderCode;
  taskId: string;
  label: string;
  status: string;
  assigneeId: number | null;
  assigneeName: string | null;
};

export type ProductionDeskLadderSnapshot = {
  stages: ProductionLadderStageSnapshot[];
  nextAction: ProductionDeskNextAction | null;
};

function toTaskIdString(id: bigint | string | number): string {
  return typeof id === "bigint" ? id.toString() : String(id);
}

export function isProductionDeskLadderCode(code: string): code is ProductionDeskLadderCode {
  return (PRODUCTION_DESK_LADDER_CODES as readonly string[]).includes(code);
}

function preferTask(
  current: ProductionLadderTaskInput | undefined,
  next: ProductionLadderTaskInput,
): ProductionLadderTaskInput {
  if (!current) return next;
  // Prefer non-cancelled over cancelled duplicates.
  if (current.status === "CANCELLED" && next.status !== "CANCELLED") return next;
  return current;
}

export function buildProductionDeskLadderSnapshot(
  tasks: ProductionLadderTaskInput[],
): ProductionDeskLadderSnapshot {
  const byCode = new Map<string, ProductionLadderTaskInput>();
  for (const task of tasks) {
    const code = task.subProcess?.code;
    if (!code || !isProductionDeskLadderCode(code)) continue;
    byCode.set(code, preferTask(byCode.get(code), task));
  }

  const stages: ProductionLadderStageSnapshot[] = PRODUCTION_DESK_LADDER_CODES.map((code) => {
    const task = byCode.get(code);
    if (!task) {
      return { code, taskId: null, status: null, assigneeId: null, assigneeName: null };
    }
    return {
      code,
      taskId: toTaskIdString(task.id),
      status: task.status,
      assigneeId: task.assignedEmployeeId ?? null,
      assigneeName: task.assignedEmployee?.name ?? null,
    };
  });

  let nextAction: ProductionDeskNextAction | null = null;
  for (const stage of stages) {
    if (!stage.taskId || !stage.status) continue;
    if (DONE_STATUSES.has(stage.status)) continue;
    nextAction = {
      code: stage.code,
      taskId: stage.taskId,
      label: PRODUCTION_DESK_STAGE_LABELS[stage.code],
      status: stage.status,
      assigneeId: stage.assigneeId,
      assigneeName: stage.assigneeName,
    };
    break;
  }

  return { stages, nextAction };
}

/**
 * Whether the current user may open/execute the desk next-action CTA.
 * Matches Task Detail control: TASK_EXECUTE + assignee (or owning role when unassigned).
 * Admin is not a free pass — they must be the assignee to execute ladder work.
 */
export function canOpenProductionDeskNextAction(input: {
  roleCode?: string | null;
  permissions: string[];
  employeeId?: number | null;
  nextAction: ProductionDeskNextAction | null;
}): boolean {
  const action = input.nextAction;
  if (!action) return false;
  if (!input.permissions.includes(PERMISSIONS.TASK_EXECUTE)) return false;

  if (action.assigneeId != null) {
    return input.employeeId != null && action.assigneeId === input.employeeId;
  }

  // Unassigned task: only the owning role may pick it up from the desk.
  return input.roleCode === PRODUCTION_DESK_STAGE_OWNER_ROLE[action.code];
}

/** Pipeline filter buckets derived from ladder + readiness. */
export type ProductionDeskPipelineBucket =
  | "blocked"
  | "handoff"
  | "instruction"
  | "ready"
  | "missing_ladder";

export function classifyProductionDeskRow(input: {
  releaseReady: boolean;
  nextAction: ProductionDeskNextAction | null;
  stages: ProductionLadderStageSnapshot[];
}): ProductionDeskPipelineBucket {
  const hasAnyStage = input.stages.some((s) => s.taskId != null);
  if (!hasAnyStage) return "missing_ladder";
  if (input.nextAction?.code === "PROD_HANDOFF") return "handoff";
  if (input.nextAction?.code === "PROD_INSTRUCTION") return "instruction";
  // Release step is only "ready" when the release gate passes.
  if (input.nextAction?.code === "PROD_RELEASE") {
    return input.releaseReady ? "ready" : "blocked";
  }
  if (!input.releaseReady) return "blocked";
  return "ready";
}

/** Re-export full post-approval list for callers that need LIVE_REVIEW too. */
export { PRODUCTION_POST_APPROVAL_CODES };
