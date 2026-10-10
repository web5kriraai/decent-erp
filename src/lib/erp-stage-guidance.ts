import { ERP_STAGE_LABELS } from "@/lib/services/erp-stage-constants";

const PAST_APPROVAL = new Set([
  "APPROVED",
  "PRODUCTION_ACCEPTED",
  "PRODUCTION_RELEASED",
  "LIVE",
  "CLOSED",
]);

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  ON_HOLD: "On hold",
  APPROVAL_PENDING: "Awaiting approval",
  REJECTED: "Rejected",
};

/** Who completes a chain stage, and the action they take. */
const STAGE_OWNER: Record<string, { role: string; step: string }> = {
  GREY_MATERIAL: {
    role: "Production Head",
    step: "starts Grey / Material and records the quantity",
  },
  CUTTING: { role: "Production Head", step: "starts Cutting and records the quantity" },
  EMBROIDERY: { role: "Production Head", step: "starts Embroidery and records the quantity" },
  GARMENTING: { role: "Production Head", step: "starts Garmenting and records the quantity" },
  FINISHING: { role: "Production Head", step: "starts Finishing and records the quantity" },
  READY_STOCK: { role: "Production Head", step: "starts Ready Stock and records the quantity" },
  SALES: { role: "Production Head", step: "starts Sales and records the quantity and invoice" },
  SALES_RETURN: { role: "Production Head", step: "starts Sales Return and records the return" },
  ACCOUNTS: { role: "Costing", step: "starts Accounts and enters the margin percent" },
};

export type FlowNotice = { title: string; body: string };

function stageLabel(module: string) {
  return ERP_STAGE_LABELS[module as keyof typeof ERP_STAGE_LABELS] ?? module.replaceAll("_", " ");
}

/** Shown when the signed-in role cannot run the current chain stage. */
export function erpStageBlockedNotice(module: string, status: string): FlowNotice | null {
  const owner = STAGE_OWNER[module];
  if (!owner) return null;
  const state = status === "IN_PROGRESS" ? "in progress" : "ready";
  return {
    title: `${stageLabel(module)} is waiting on ${owner.role}`,
    body: `This stage is ${state}. Only ${owner.role} can complete it. ${owner.role} ${owner.step}.`,
  };
}

/** Shown while the design has not passed Management sign-off. */
export function releaseApprovalNotice(designStatus: string): FlowNotice | null {
  if (PAST_APPROVAL.has(designStatus)) return null;
  if (designStatus === "APPROVAL_PENDING") {
    return {
      title: "Production Release is waiting on Management",
      body: "Design Head has requested sign-off. Management approves this design in Approvals. Production Head can end Production Release after that approval.",
    };
  }
  const statusLabel = STATUS_LABELS[designStatus] ?? designStatus.replaceAll("_", " ").toLowerCase();
  return {
    title: "Production Release is waiting on approval",
    body: `This design is still ${statusLabel}. Design Head requests sign-off. Management then approves it in Approvals. Production Head can end Production Release after that approval.`,
  };
}

/** Single checklist line for the complete dialog and the API error. */
export function releaseApprovalGapMessage(designStatus: string): string {
  return releaseApprovalNotice(designStatus)?.body ?? "Management must approve this design before Production Release can finish.";
}
