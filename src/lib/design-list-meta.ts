import { getDesignWorkflowContext } from "@/lib/design-workflow";
import { isOpenCorrectionStatus } from "@/lib/services/correction-queue-utils";
import type { DesignTask } from "@/lib/types/api";

export type DesignListMeta = {
  assignmentMode: "AUTOMATIC" | "MANUAL";
  workflowTypeLabel: string;
  currentStageName: string;
  currentAssigneeName: string | null;
  pendingReviewerName: string | null;
  openCorrectionCount: number;
  maxCorrectionCycle: number;
};

type ListDesignRow = {
  assignmentMode: "AUTOMATIC" | "MANUAL";
  status: string;
  tasks?: DesignTask[];
  corrections?: Array<{ status: string; cycleNo?: number }>;
};

export function buildDesignListMeta(row: ListDesignRow): DesignListMeta {
  const tasks = row.tasks ?? [];
  const ctx = getDesignWorkflowContext({ status: row.status, tasks });
  const activeTask =
    tasks.find((t) =>
      ["RUNNING", "ASSIGNED", "ON_HOLD", "CORRECTION_REQUIRED", "CHECKING"].includes(t.status),
    ) ?? tasks.find((t) => t.status !== "COMPLETED" && t.status !== "SKIPPED" && t.status !== "PENDING");

  const pendingApproval = tasks.find(
    (t) =>
      t.subProcess?.isApproval &&
      ["PENDING", "ASSIGNED", "RUNNING", "ON_HOLD", "CHECKING"].includes(t.status),
  );

  const openCorrections = (row.corrections ?? []).filter((c) =>
    isOpenCorrectionStatus(c.status),
  );
  const maxCycle = (row.corrections ?? []).reduce(
    (max, c) => Math.max(max, c.cycleNo ?? 1),
    0,
  );

  return {
    assignmentMode: row.assignmentMode,
    workflowTypeLabel: row.assignmentMode === "AUTOMATIC" ? "Automatic" : "Manual",
    currentStageName: ctx.currentStage?.trim() || stageNameForStatus(row.status),
    currentAssigneeName:
      ctx.currentOwner ?? activeTask?.assignedEmployee?.name ?? null,
    pendingReviewerName:
      pendingApproval?.assignedEmployee?.name ??
      (pendingApproval ? "Role queue" : null),
    openCorrectionCount: openCorrections.length,
    maxCorrectionCycle: maxCycle,
  };
}

function stageNameForStatus(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ON_HOLD":
      return "On hold";
    case "APPROVED":
      return "Approved";
    case "PRODUCTION_ACCEPTED":
      return "Production accepted";
    case "PRODUCTION_RELEASED":
      return "Released to production";
    case "LIVE":
      return "Live";
    case "CLOSED":
      return "Closed";
    case "REJECTED":
      return "Rejected";
    default:
      return "-";
  }
}

export function attachListMeta<T extends ListDesignRow>(
  row: T,
): T & { listMeta: DesignListMeta } {
  return { ...row, listMeta: buildDesignListMeta(row) };
}
