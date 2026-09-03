"use client";

import { useEffect } from "react";
import Link from "next/link";
import { InfoIcon } from "lucide-react";
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

  useEffect(() => {
    if (decisionOptions.length === 0) return;
    if (!decisionOptions.some((o) => o.value === decision)) {
      onChange({ ...state, decision: decisionOptions[0].value });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionOptions]);

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
    <div className="approval-decision-form">
      <ApprovalRequestPackagePanel package={requestPackage} designId={designId} />

      {costingReady === false ? (
        <p className="approval-decision-alert" role="alert">
          Final approval needs costing first. Approve is hidden until you add a cost entry on{" "}
          <Link href={ROUTES.finance.costing} className="font-medium underline">
            Finance → Costing
          </Link>
          . Reject or Send for Correction still available.
        </p>
      ) : null}

      <section className="approval-decision-section" aria-label="Your decision">
        <p className="approval-decision-section-title">Your decision</p>

        {decision === "APPROVED" ? (
          <div className="approval-decision-split">
            <div className="approval-decision-col">
              <FormSelect
                id="approvalDecision"
                label="Decision"
                required
                value={decision}
                onValueChange={(v) =>
                  onChange({
                    ...state,
                    decision: v as ApprovalDecisionValue,
                    remark: state.remark,
                  })
                }
                options={decisionOptions}
              />
              <p className="approval-decision-info">
                <InfoIcon aria-hidden />
                <span>
                  {nextLevelName
                    ? `Next after approve: ${nextLevelName}.`
                    : "Final approve marks the design APPROVED for production handoff."}
                </span>
              </p>
            </div>
            <div className="approval-decision-col">
              <FormTextArea
                id="approvalRemark"
                label="Remark (optional)"
                rows={3}
                value={remark}
                onChange={(e) => onChange({ ...state, remark: e.target.value })}
                placeholder="Optional notes for the design team…"
              />
            </div>
          </div>
        ) : (
          <div className="approval-decision-fields">
            <FormSelect
              id="approvalDecision"
              label="Decision"
              required
              value={decision}
              onValueChange={(v) =>
                onChange({
                  ...state,
                  decision: v as ApprovalDecisionValue,
                  remark: state.remark,
                })
              }
              options={decisionOptions}
            />

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
                <p className="approval-decision-impact approval-decision-impact--danger">
                  Design becomes REJECTED; requester is notified. History is kept.
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
                <div className="approval-decision-grid">
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
                </div>
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
                    hint="Optional — defaults to stage assignee when blank."
                  />
                ) : null}
                <p className="approval-decision-impact approval-decision-impact--warn">
                  Assigns to{" "}
                  <strong>{correctionAssigneePreview ?? "stage assignee (on submit)"}</strong> for{" "}
                  <strong>{routeSubProcessCode}</strong>. Prior management approvals clear for
                  re-approval after rework.
                </p>
              </>
            ) : null}
          </div>
        )}
      </section>
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
