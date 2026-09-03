"use client";

import Link from "next/link";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { ROUTES } from "@/config/routes";
import { ApprovalRequestPackagePanel } from "@/components/approvals/ApprovalRequestPackagePanel";
import {
  previewCorrectionAssignee,
  type ApprovalRequestPackage,
  type ApprovalRequestStageAssignee,
} from "@/lib/approval-request-package";

export type ApprovalDecisionValue = "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED";

export const CORRECTION_ROUTE_OPTIONS = [
  { value: "PUNCH", label: "Punching / Wilcom" },
  { value: "SKETCH", label: "Sketch" },
  { value: "MACHINE_SAMPLE", label: "Machine Sample" },
  { value: "COSTING", label: "Costing" },
] as const;

export const CORRECTION_TYPE_OPTIONS = [
  { value: "MISTAKE", label: "Mistake" },
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "CUSTOMER_CHANGE", label: "Customer change" },
  { value: "MACHINE", label: "Machine" },
  { value: "MATERIAL", label: "Material" },
  { value: "OTHER", label: "Other" },
] as const;

export type ApprovalDecisionFormState = {
  decision: ApprovalDecisionValue;
  remark: string;
  correctionType: string;
  routeSubProcessCode: string;
  responsibleEmployeeId: string;
};

type DecisionOption = { value: ApprovalDecisionValue; label: string };

type EmployeeOption = { id: number; name: string };

type ApprovalDecisionFormProps = {
  designId: string;
  requestPackage?: ApprovalRequestPackage | null;
  costingReady?: boolean;
  decisionOptions: DecisionOption[];
  state: ApprovalDecisionFormState;
  onChange: (next: ApprovalDecisionFormState) => void;
  stageAssignees?: ApprovalRequestStageAssignee[] | null;
  employeeOptions?: EmployeeOption[];
  nextLevelName?: string | null;
};

export function ApprovalDecisionForm({
  designId,
  requestPackage,
  costingReady,
  decisionOptions,
  state,
  onChange,
  stageAssignees,
  employeeOptions = [],
  nextLevelName,
}: ApprovalDecisionFormProps) {
  const { decision, remark, correctionType, routeSubProcessCode, responsibleEmployeeId } = state;

  const assignees =
    stageAssignees?.length
      ? stageAssignees
      : (requestPackage?.snapshot.stageAssignees ?? []);

  const correctionAssigneePreview = previewCorrectionAssignee({
    routeSubProcessCode,
    stageAssignees: assignees,
    responsibleEmployeeId,
    employees: employeeOptions,
  });

  return (
    <div className="space-y-4">
      <ApprovalRequestPackagePanel package={requestPackage} designId={designId} />

      {decision === "APPROVED" && costingReady === false ? (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="alert"
        >
          Final management approval needs costing first. Add at least one cost entry on{" "}
          <Link href={ROUTES.finance.costing} className="font-medium underline">
            Finance → Costing
          </Link>
          , then return here to approve.
        </p>
      ) : null}

      <FormSelect
        id="approvalDecision"
        label="Decision"
        required
        value={decision}
        onValueChange={(v) =>
          onChange({ ...state, decision: v as ApprovalDecisionValue, remark: state.remark })
        }
        options={decisionOptions}
      />

      {decision === "APPROVED" ? (
        <>
          <FormTextArea
            id="approvalRemark"
            label="Remark (optional)"
            rows={3}
            value={remark}
            onChange={(e) => onChange({ ...state, remark: e.target.value })}
            placeholder="Optional notes for the design team…"
          />
          <p className="text-xs text-muted-foreground">
            {nextLevelName
              ? `Next in chain after approve: ${nextLevelName}.`
              : "Approving the final level marks the design APPROVED for production handoff."}
          </p>
        </>
      ) : null}

      {decision === "REJECTED" ? (
        <>
          <FormTextArea
            id="approvalRejectRemark"
            label="Rejection reason"
            rows={3}
            required
            value={remark}
            onChange={(e) => onChange({ ...state, remark: e.target.value })}
            placeholder="Required — explain why this design was rejected…"
          />
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
            Impact: design status becomes REJECTED and the requester is notified. History is preserved.
          </p>
        </>
      ) : null}

      {decision === "CORRECTION_REQUIRED" ? (
        <>
          <FormTextArea
            id="approvalCorrectionRemark"
            label="What must be fixed"
            rows={3}
            required
            value={remark}
            onChange={(e) => onChange({ ...state, remark: e.target.value })}
            placeholder="Required — describe the correction clearly…"
          />
          <FormSelect
            id="correctionType"
            label="Correction type"
            required
            value={correctionType}
            onValueChange={(v) => onChange({ ...state, correctionType: v })}
            options={[...CORRECTION_TYPE_OPTIONS]}
          />
          <FormSelect
            id="routeSubProcess"
            label="Route back to stage"
            required
            value={routeSubProcessCode}
            onValueChange={(v) => onChange({ ...state, routeSubProcessCode: v })}
            options={[...CORRECTION_ROUTE_OPTIONS]}
          />
          {correctionType === "MISTAKE" ? (
            <FormSelect
              id="responsibleEmployeeId"
              label="Responsible employee"
              required={false}
              value={responsibleEmployeeId || null}
              onValueChange={(v) => onChange({ ...state, responsibleEmployeeId: v })}
              options={employeeOptions.map((e) => ({
                value: String(e.id),
                label: e.name,
              }))}
              placeholder="Select employee…"
              hint="Optional override — defaults to the stage assignee when blank."
            />
          ) : null}
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Correction will assign to{" "}
            <strong>{correctionAssigneePreview ?? "the stage assignee (resolved on submit)"}</strong>{" "}
            for stage <strong>{routeSubProcessCode}</strong>. Prior management approvals are cleared so
            the chain re-approves after rework.
          </p>
        </>
      ) : null}
    </div>
  );
}

export function defaultApprovalDecisionFormState(): ApprovalDecisionFormState {
  return {
    decision: "APPROVED",
    remark: "",
    correctionType: "IMPROVEMENT",
    routeSubProcessCode: "PUNCH",
    responsibleEmployeeId: "",
  };
}

export function isApprovalDecisionFormValid(
  state: ApprovalDecisionFormState,
  costingReady?: boolean,
): boolean {
  if (state.decision === "APPROVED") {
    return costingReady !== false;
  }
  if (state.decision === "REJECTED") {
    return state.remark.trim().length > 0;
  }
  return (
    state.remark.trim().length > 0 &&
    !!state.correctionType &&
    !!state.routeSubProcessCode
  );
}
