import { ROUTES } from "@/config/routes";

export type ApprovalRequestSnapshotFile = {
  id: string;
  fileName: string;
  isPrimary: boolean;
};

export type ApprovalRequestStageAssignee = {
  code: string;
  name: string;
  assigneeEmployeeId: number | null;
  assigneeName: string | null;
};

export type ApprovalRequestSnapshot = {
  ideaRef: string;
  collectionName: string;
  productType: string;
  priority: string;
  statusBeforeRequest: string;
  completedStages: string[];
  openCorrections: number;
  costingEntryCount: number;
  costingTotal: number;
  primaryFiles: ApprovalRequestSnapshotFile[];
  stageAssignees?: ApprovalRequestStageAssignee[];
};

export type ApprovalRequestPackage = {
  requesterEmployeeId: number;
  requesterName: string;
  requestedAtUtc: string;
  requesterRemark: string;
  summaryNote?: string | null;
  snapshot: ApprovalRequestSnapshot;
};

/** Deep-link into design detail files section, optionally highlighting one image. */
export function designFileDeepLink(designId: string, fileId?: string): string {
  const base = `${ROUTES.designs.detail(designId)}?setup=images#design-files`;
  if (!fileId) return base;
  return `${ROUTES.designs.detail(designId)}?setup=images&image=${encodeURIComponent(fileId)}#design-files`;
}

export function parseApprovalRequestPackage(raw: unknown): ApprovalRequestPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.requesterRemark !== "string" || typeof obj.requesterName !== "string") {
    return null;
  }
  if (!obj.snapshot || typeof obj.snapshot !== "object") return null;
  return obj as ApprovalRequestPackage;
}

export function validateManagementSignOffRequest(input: {
  roleCode?: string | null;
  requesterRemark?: string | null;
}): { ok: true; remark: string } | { ok: false; status: 400 | 403; message: string } {
  const remark = input.requesterRemark?.trim() ?? "";
  if (remark.length < 8) {
    return {
      ok: false,
      status: 400,
      message: "Requester remark is required (at least 8 characters) before requesting management sign-off.",
    };
  }
  if (input.roleCode !== "DESIGN_HEAD") {
    return {
      ok: false,
      status: 403,
      message:
        "Only Design Head can request management sign-off. System Admin configures the system; Management acts on the approval chain.",
    };
  }
  return { ok: true, remark };
}

export function previewCorrectionAssignee(input: {
  routeSubProcessCode: string;
  stageAssignees?: ApprovalRequestStageAssignee[] | null;
  responsibleEmployeeId?: string | number | null;
  employees?: Array<{ id: number; name: string }> | null;
}): string | null {
  const responsibleId =
    input.responsibleEmployeeId === "" || input.responsibleEmployeeId == null
      ? null
      : Number(input.responsibleEmployeeId);
  if (responsibleId && Number.isFinite(responsibleId)) {
    const named = input.employees?.find((e) => e.id === responsibleId)?.name;
    if (named) return named;
  }
  const stage = input.stageAssignees?.find((s) => s.code === input.routeSubProcessCode);
  return stage?.assigneeName ?? null;
}
