const SATISFIED_TASK = new Set(["COMPLETED", "CHECKING", "CANCELLED"]);

/** Tasks outside development sign-off scope — do not block ready-for-sign-off. */
const SIGNOFF_SCOPE_EXCLUDED_CODES = new Set([
  "CORRECTION",
  "RESAMPLE",
  "PROD_HANDOFF",
  "PROD_INSTRUCTION",
  "PROD_RELEASE",
  "LIVE_REVIEW",
]);

/** Roles that see all portfolio-ready designs (executive oversight). */
export const READY_SIGNOFF_GLOBAL_ROLES = new Set(["ADMIN", "MANAGEMENT"]);

export function readyForSignOffScopeFilter(
  employeeId: number,
  roleCode: string | null | undefined,
): { designHeadEmployeeId?: number } {
  if (roleCode && READY_SIGNOFF_GLOBAL_ROLES.has(roleCode)) {
    return {};
  }
  return { designHeadEmployeeId: employeeId };
}

export function canEmployeeActOnApprovalLevel(
  level: { requiredRoleId?: number | null },
  employeeRoleId: number | null | undefined,
  employeeRoleCode: string | null | undefined,
): boolean {
  if (!level.requiredRoleId) return true;
  if (employeeRoleCode === "ADMIN") return true;
  return employeeRoleId === level.requiredRoleId;
}

export function isDesignReadyForSignOff(
  tasks: Array<{ status: string; subProcess: { code: string; isApproval: boolean } }>,
): boolean {
  const inSignOffScope = (code: string) => !SIGNOFF_SCOPE_EXCLUDED_CODES.has(code);

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
  tasks: Array<{
    id: bigint | string | number;
    process: { name: string };
    subProcess: { name: string };
  }>;
};

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
};

/** Pure builder — excludes stuck designs where every level is already APPROVED/SKIPPED. */
export function buildPendingApprovalItems(
  designs: PendingDesignRow[],
  levels: ApprovalLevelRow[],
): BuiltPendingApprovalItem[] {
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
        task: design.tasks[0]
          ? {
              id: design.tasks[0].id.toString(),
              process: design.tasks[0].process,
              subProcess: design.tasks[0].subProcess,
            }
          : null,
        existingApprovalId: existingPending?.id?.toString() ?? null,
      },
    ];
  });
}
