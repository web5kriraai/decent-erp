import { ROUTES } from "@/config/routes";
import { designRequiresCosting } from "@/lib/workflow/transition-policies";

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

/** Rich completed-stage row (optional; legacy packages only have string names). */
export type ApprovalRequestCompletedStageDetail = {
  code?: string;
  name: string;
  outputRemark?: string | null;
  assigneeName?: string | null;
  completedAt?: string | null;
};

export type ApprovalRequestOpenCorrectionBrief = {
  id: string;
  type?: string | null;
  rootCause?: string | null;
};

export type ApprovalRequestPriorManagementDecision = {
  levelName: string;
  decision: string;
  remark?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
};

export type ApprovalRequestSnapshot = {
  ideaRef: string;
  collectionName: string;
  productType: string;
  priority: string;
  statusBeforeRequest: string;
  /** Legacy-friendly stage names (always populated for new packages). */
  completedStages: string[];
  /** Optional rich stage rows; prefer this in UI when present. */
  completedStageDetails?: ApprovalRequestCompletedStageDetail[];
  openCorrections: number;
  /** Optional briefs for open corrections (id + type/root cause). */
  openCorrectionBriefs?: ApprovalRequestOpenCorrectionBrief[];
  /** Prior management decisions still on the design (e.g. after correction cycles). */
  priorManagementDecisions?: ApprovalRequestPriorManagementDecision[];
  costingEntryCount: number;
  costingTotal: number;
  /** Presence-driven: true only when an active costingEntry stage exists on the design. */
  requiresCosting?: boolean;
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

function asOptionalString(value: unknown): string | null | undefined {
  if (value == null) return value as null | undefined;
  if (typeof value === "string") return value;
  return undefined;
}

function parseCompletedStageDetail(raw: unknown): ApprovalRequestCompletedStageDetail | null {
  if (typeof raw === "string") {
    const name = raw.trim();
    return name ? { name } : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name =
    typeof row.name === "string"
      ? row.name.trim()
      : typeof row.label === "string"
        ? row.label.trim()
        : "";
  if (!name) return null;
  return {
    code: typeof row.code === "string" ? row.code : undefined,
    name,
    outputRemark: asOptionalString(row.outputRemark),
    assigneeName: asOptionalString(row.assigneeName),
    completedAt: asOptionalString(row.completedAt),
  };
}

function parseOpenCorrectionBrief(raw: unknown): ApprovalRequestOpenCorrectionBrief | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id =
    typeof row.id === "string"
      ? row.id
      : typeof row.id === "number" || typeof row.id === "bigint"
        ? String(row.id)
        : "";
  if (!id) return null;
  return {
    id,
    type: asOptionalString(row.type) ?? asOptionalString(row.correctionType),
    rootCause: asOptionalString(row.rootCause),
  };
}

function parsePriorManagementDecision(
  raw: unknown,
): ApprovalRequestPriorManagementDecision | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const levelName = typeof row.levelName === "string" ? row.levelName.trim() : "";
  const decision = typeof row.decision === "string" ? row.decision.trim() : "";
  if (!levelName || !decision) return null;
  return {
    levelName,
    decision,
    remark: asOptionalString(row.remark),
    decidedBy: asOptionalString(row.decidedBy),
    decidedAt: asOptionalString(row.decidedAt),
  };
}

/** Prefer completedStageDetails; fall back to legacy completedStages strings. */
export function resolveCompletedStageDetails(
  snapshot: ApprovalRequestSnapshot | null | undefined,
): ApprovalRequestCompletedStageDetail[] {
  if (!snapshot) return [];
  if (snapshot.completedStageDetails && snapshot.completedStageDetails.length > 0) {
    return snapshot.completedStageDetails;
  }
  return (snapshot.completedStages ?? []).map((name) => ({ name }));
}

/**
 * Normalize stored JSON into ApprovalRequestPackage.
 * Accepts legacy string[] completedStages and/or completedStageDetails objects.
 */
export function parseApprovalRequestPackage(raw: unknown): ApprovalRequestPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.requesterRemark !== "string" || typeof obj.requesterName !== "string") {
    return null;
  }
  if (!obj.snapshot || typeof obj.snapshot !== "object") return null;

  const snapRaw = obj.snapshot as Record<string, unknown>;
  const fromStagesField = Array.isArray(snapRaw.completedStages)
    ? snapRaw.completedStages.map(parseCompletedStageDetail).filter(Boolean)
    : [];
  const fromDetailsField = Array.isArray(snapRaw.completedStageDetails)
    ? snapRaw.completedStageDetails.map(parseCompletedStageDetail).filter(Boolean)
    : [];

  const detailRows =
    fromDetailsField.length > 0
      ? (fromDetailsField as ApprovalRequestCompletedStageDetail[])
      : (fromStagesField as ApprovalRequestCompletedStageDetail[]);

  const completedStages =
    detailRows.length > 0
      ? detailRows.map((d) => d.name)
      : Array.isArray(snapRaw.completedStages)
        ? snapRaw.completedStages.filter((s): s is string => typeof s === "string")
        : [];

  const openCorrectionBriefs = Array.isArray(snapRaw.openCorrectionBriefs)
    ? (snapRaw.openCorrectionBriefs
        .map(parseOpenCorrectionBrief)
        .filter(Boolean) as ApprovalRequestOpenCorrectionBrief[])
    : undefined;

  const priorManagementDecisions = Array.isArray(snapRaw.priorManagementDecisions)
    ? (snapRaw.priorManagementDecisions
        .map(parsePriorManagementDecision)
        .filter(Boolean) as ApprovalRequestPriorManagementDecision[])
    : undefined;

  const snapshot: ApprovalRequestSnapshot = {
    ...(snapRaw as unknown as ApprovalRequestSnapshot),
    completedStages,
    completedStageDetails: detailRows.length > 0 ? detailRows : undefined,
    openCorrectionBriefs:
      openCorrectionBriefs && openCorrectionBriefs.length > 0
        ? openCorrectionBriefs
        : undefined,
    priorManagementDecisions:
      priorManagementDecisions && priorManagementDecisions.length > 0
        ? priorManagementDecisions
        : undefined,
  };

  return {
    ...(obj as unknown as ApprovalRequestPackage),
    snapshot,
  };
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
      message: "Approver remark is required (at least 8 characters) before approving for production.",
    };
  }
  if (input.roleCode !== "DESIGN_HEAD") {
    return {
      ok: false,
      status: 403,
      message:
        "Only Design Head can approve for production. System Admin configures the system; stage owners decide Approve / Reject / Correction on workflow stages.",
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

const COMPLETED_TASK_STATUSES = new Set(["COMPLETED", "CHECKING", "SKIPPED"]);
const OPEN_CORRECTION_STATUSES = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"]);

type PreviewDesignTask = {
  status: string;
  outputRemark?: string | null;
  completedAt?: string | null;
  assignedEmployeeId?: number | null;
  assignedEmployee?: { id?: number; name?: string | null } | null;
  subProcess?: {
    code?: string;
    name?: string;
    isApproval?: boolean;
    isFileRequired?: boolean;
    capabilities?: unknown;
  } | null;
};

type PreviewCorrection = {
  id?: string | number | bigint;
  status?: string;
  correctionType?: string | null;
  type?: string | null;
  rootCause?: string | null;
};

type PreviewApproval = {
  decision?: string;
  remark?: string | null;
  decisionAtUtc?: string | null;
  level?: { name?: string | null } | null;
  approvalLevel?: { name?: string | null } | null;
  approver?: { name?: string | null } | null;
};

type PreviewDesignImage = {
  id?: string | number | bigint;
  fileName?: string;
  isPrimary?: boolean;
};

type PreviewDesignCost = {
  amount?: number | string | null;
};

/** Client-side live package preview from design detail (before submit). */
export function buildLiveApprovalPackagePreview(input: {
  design: {
    ideaRef: string;
    collectionName: string;
    status: string;
    priority: string;
    productType?: { name?: string | null } | null;
    designHead?: { id?: number; name?: string | null } | null;
    tasks?: PreviewDesignTask[] | null;
    corrections?: PreviewCorrection[] | null;
    approvals?: PreviewApproval[] | null;
    images?: PreviewDesignImage[] | null;
    costs?: PreviewDesignCost[] | null;
  };
  requesterRemark: string;
  summaryNote?: string | null;
  requesterName?: string | null;
  requesterEmployeeId?: number | null;
}): ApprovalRequestPackage {
  const { design } = input;
  const tasks = design.tasks ?? [];
  const completedTasks = tasks.filter((t) => COMPLETED_TASK_STATUSES.has(t.status));
  const completedStageDetails: ApprovalRequestCompletedStageDetail[] = completedTasks.map(
    (t) => ({
      code: t.subProcess?.code,
      name: t.subProcess?.name ?? "Stage",
      outputRemark: t.outputRemark ?? null,
      assigneeName: t.assignedEmployee?.name ?? null,
      completedAt: t.completedAt ?? null,
    }),
  );

  const openCorrections = (design.corrections ?? []).filter((c) =>
    c.status ? OPEN_CORRECTION_STATUSES.has(c.status) : true,
  );
  const openCorrectionBriefs: ApprovalRequestOpenCorrectionBrief[] = openCorrections
    .map((c) => {
      const id =
        c.id == null ? "" : typeof c.id === "string" ? c.id : String(c.id);
      if (!id) return null;
      return {
        id,
        type: c.type ?? c.correctionType ?? null,
        rootCause: c.rootCause ?? null,
      };
    })
    .filter(Boolean) as ApprovalRequestOpenCorrectionBrief[];

  const priorManagementDecisions: ApprovalRequestPriorManagementDecision[] = (
    design.approvals ?? []
  )
    .filter((a) => a.decision && a.decision !== "PENDING")
    .map((a) => ({
      levelName: a.level?.name ?? a.approvalLevel?.name ?? "Management",
      decision: a.decision!,
      remark: a.remark ?? null,
      decidedBy: a.approver?.name ?? null,
      decidedAt: a.decisionAtUtc ?? null,
    }));

  const costs = design.costs ?? [];
  const positiveCosts = costs.filter((c) => Number(c.amount ?? 0) > 0);
  const costingTotal = positiveCosts.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
  const images = design.images ?? [];

  const stageAssignees: ApprovalRequestStageAssignee[] = tasks
    .filter((t) => !t.subProcess?.isApproval)
    .map((t) => ({
      code: t.subProcess?.code ?? "",
      name: t.subProcess?.name ?? "Stage",
      assigneeEmployeeId: t.assignedEmployeeId ?? t.assignedEmployee?.id ?? null,
      assigneeName: t.assignedEmployee?.name ?? null,
    }));

  const policyTasks = tasks
    .filter((t) => t.subProcess?.code)
    .map((t) => ({
      status: t.status,
      subProcess: {
        code: t.subProcess!.code!,
        name: t.subProcess?.name,
        isApproval: t.subProcess?.isApproval,
        isFileRequired: t.subProcess?.isFileRequired,
        capabilities: t.subProcess?.capabilities,
      },
    }));
  const requiresCosting = designRequiresCosting(policyTasks);

  return {
    requesterEmployeeId: input.requesterEmployeeId ?? design.designHead?.id ?? 0,
    requesterName: input.requesterName?.trim() || design.designHead?.name || "You",
    requestedAtUtc: new Date().toISOString(),
    requesterRemark: input.requesterRemark.trim() || "(Enter requester remark)",
    summaryNote: input.summaryNote?.trim() || null,
    snapshot: {
      ideaRef: design.ideaRef,
      collectionName: design.collectionName,
      productType: design.productType?.name ?? "—",
      priority: design.priority,
      statusBeforeRequest: design.status,
      completedStages: completedStageDetails.map((d) => d.name),
      completedStageDetails,
      openCorrections: openCorrections.length,
      openCorrectionBriefs:
        openCorrectionBriefs.length > 0 ? openCorrectionBriefs : undefined,
      priorManagementDecisions:
        priorManagementDecisions.length > 0 ? priorManagementDecisions : undefined,
      costingEntryCount: positiveCosts.length,
      costingTotal,
      requiresCosting,
      primaryFiles: images.slice(0, 5).map((img) => ({
        id: img.id == null ? "" : String(img.id),
        fileName: img.fileName ?? "file",
        isPrimary: !!img.isPrimary,
      })),
      stageAssignees,
    },
  };
}
