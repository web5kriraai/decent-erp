import { canRoleActOnManagementLevel } from "@/lib/approval-hub-rbac";
import { ROLE_CODES } from "@/lib/permissions";

const SATISFIED_TASK = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);

/**
 * Tasks outside development sign-off scope — do not block ready-for-sign-off.
 * RESAMPLE is intentionally NOT excluded: checker must re-approve after re-sample.
 */
export const SIGNOFF_SCOPE_EXCLUDED_CODES = new Set([
  "CORRECTION",
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
  "LIVE_REVIEW",
]);

export function isSignOffScopeExcluded(code: string | null | undefined): boolean {
  return !!code && SIGNOFF_SCOPE_EXCLUDED_CODES.has(code);
}

export function readyForSignOffScopeFilter(
  employeeId: number,
  roleCode: string | null | undefined,
): { designHeadEmployeeId?: number } {
  if (roleCode === "DESIGN_HEAD") {
    return { designHeadEmployeeId: employeeId };
  }
  return { designHeadEmployeeId: employeeId };
}

export function canEmployeeActOnApprovalLevel(
  level: { requiredRoleId?: number | null; code?: string },
  employeeRoleId: number | null | undefined,
  employeeRoleCode: string | null | undefined,
): boolean {
  if (employeeRoleCode === ROLE_CODES.ADMIN) return true;
  if (!level.requiredRoleId) return true;
  if (employeeRoleCode && level.code && !canRoleActOnManagementLevel(employeeRoleCode, level.code)) {
    return false;
  }
  return employeeRoleId === level.requiredRoleId;
}

export function isDesignReadyForSignOff(
  tasks: Array<{ status: string; subProcess: { code: string; isApproval: boolean } }>,
): boolean {
  const inSignOffScope = (code: string) => !isSignOffScopeExcluded(code);

  const openApprovals = tasks.some(
    (t) =>
      t.subProcess.isApproval &&
      inSignOffScope(t.subProcess.code) &&
      !SATISFIED_TASK.has(t.status) &&
      t.status !== "CANCELLED",
  );
  if (openApprovals) return false;

  const incomplete = tasks.filter(
    (t) => inSignOffScope(t.subProcess.code) && !SATISFIED_TASK.has(t.status),
  );
  return incomplete.length === 0;
}

type ApprovalLevelRow = {
  id: number;
  code?: string;
  name?: string;
  sequence?: number;
  requiredRoleId?: number | null;
};

type PendingDesignTaskRow = {
  id: bigint | string | number;
  status: string;
  sequence: number;
  process: { name: string };
  subProcess: { name: string; code: string; isApproval?: boolean };
};

type PendingDesignRow = {
  id: bigint | string | number;
  ideaRef: string;
  collectionName: string;
  status: string;
  priority?: string;
  approvals: Array<{
    approvalLevelId: number;
    decision: string;
    id?: bigint | string | number;
  }>;
  tasks: PendingDesignTaskRow[];
};

/** Pick the work task most relevant to the current management approval level. */
export function pickRelatedApprovalTask(
  tasks: PendingDesignTaskRow[],
  currentLevelCode?: string,
): PendingDesignTaskRow | null {
  if (tasks.length === 0) return null;

  const sorted = [...tasks].sort((a, b) => b.sequence - a.sequence);

  const completedWork = sorted.find(
    (t) =>
      !t.subProcess.isApproval &&
      (t.status === "COMPLETED" || t.status === "CHECKING"),
  );
  if (completedWork) return completedWork;

  if (currentLevelCode === "MANAGEMENT_APPROVAL") {
    const costing = sorted.find((t) => t.subProcess.code === "COSTING");
    if (costing) return costing;
  }

  const latestWork = sorted.find((t) => !t.subProcess.isApproval);
  return latestWork ?? sorted[0] ?? null;
}

export type BuiltPendingApprovalItem = {
  designId: string;
  design: {
    id: string;
    ideaRef: string;
    collectionName: string;
    status: string;
    priority?: string;
  };
  currentLevel: ApprovalLevelRow;
  task: {
    id: string;
    process: { name: string };
    subProcess: { name: string };
  } | null;
  existingApprovalId: string | null;
  costingReady: boolean;
};

/** Pure builder — excludes stuck designs where every level is already APPROVED/SKIPPED. */
export function buildPendingApprovalItems(
  designs: PendingDesignRow[],
  levels: ApprovalLevelRow[],
  options?: { designIdsWithCosting?: Set<string> },
): BuiltPendingApprovalItem[] {
  const withCosting = options?.designIdsWithCosting;
  const lastLevel = levels.length > 0 ? levels[levels.length - 1] : null;

  return designs.flatMap((design) => {
    const passedLevelIds = new Set(
      design.approvals
        .filter((a) => a.decision === "APPROVED" || a.decision === "SKIPPED")
        .map((a) => a.approvalLevelId),
    );
    const nextLevel = levels.find((l) => !passedLevelIds.has(l.id));
    if (!nextLevel) return [];

    const existingPending = design.approvals.find(
      (a) => a.approvalLevelId === nextLevel.id && a.decision === "PENDING",
    );

    const designId = design.id.toString();
    const isFinalLevel = lastLevel != null && nextLevel.id === lastLevel.id;
    const costingReady = !isFinalLevel || (withCosting?.has(designId) ?? true);

    return [
      {
        designId,
        design: {
          id: designId,
          ideaRef: design.ideaRef,
          collectionName: design.collectionName,
          status: design.status,
          priority: design.priority,
        },
        currentLevel: nextLevel,
        task: (() => {
          const related = pickRelatedApprovalTask(design.tasks, nextLevel.code);
          return related
            ? {
                id: related.id.toString(),
                process: related.process,
                subProcess: related.subProcess,
              }
            : null;
        })(),
        existingApprovalId: existingPending?.id?.toString() ?? null,
        costingReady,
      },
    ];
  });
}
