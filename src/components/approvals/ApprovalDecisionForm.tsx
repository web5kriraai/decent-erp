"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IconInfo } from "@/components/icons";
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

const FALLBACK_ROUTE_OPTIONS = [
  { value: "PUNCH", label: "Punching / Wilcom" },
  { value: "SKETCH", label: "Sketch" },
  { value: "MACHINE_SAMPLE", label: "Machine Sample" },
  { value: "COSTING", label: "Costing" },
] as const;

const CORRECTION_TYPE_OPTIONS = [
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
  reworkAssigneeEmployeeId: string;
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
  onEnterSubmit?: () => void;
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
  onEnterSubmit,
}: ApprovalDecisionFormProps) {
  const {
    decision,
    remark,
    correctionType,
    routeSubProcessCode,
    responsibleEmployeeId,
    reworkAssigneeEmployeeId,
  } = state;

  const enterSubmit =
    onEnterSubmit && isApprovalDecisionFormValid(state, costingReady) ? onEnterSubmit : undefined;

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

  const routeOptions =
    assignees.length > 0
      ? assignees.map((a) => ({ value: a.code, label: a.name }))
      : [...FALLBACK_ROUTE_OPTIONS];

  const stageDefaultAssigneeId =
    assignees.find((a) => a.code === routeSubProcessCode)?.assigneeEmployeeId ?? null;

  useEffect(() => {
    if (decision !== "CORRECTION_REQUIRED") return;
    if (reworkAssigneeEmployeeId) return;
    if (stageDefaultAssigneeId) {
      onChange({
        ...state,
        reworkAssigneeEmployeeId: String(stageDefaultAssigneeId),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, routeSubProcessCode, stageDefaultAssigneeId]);

  const correctionAssigneePreview = previewCorrectionAssignee({
    routeSubProcessCode,
    stageAssignees: assignees,
    responsibleEmployeeId: reworkAssigneeEmployeeId || responsibleEmployeeId,
    employees: employeeOptions,
  });

  return (
    <div className="approval-decision-form">
      <ApprovalRequestPackagePanel package={requestPackage} designId={designId} />

      {costingReady === false ? (
        <p className="approval-decision-alert" role="alert">
          Costing required before approve.{" "}
          <Link href={ROUTES.finance.costing} className="font-medium underline">
            Open Costing
          </Link>
          . Reject or correction still available.
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
                <IconInfo aria-hidden />
                <span>
                  {nextLevelName
                    ? `Next: ${nextLevelName}.`
                    : "Approves for production."}
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
                placeholder="Optional notes…"
                onEnterSubmit={enterSubmit}
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
                  placeholder="Explain the rejection…"
                  onEnterSubmit={enterSubmit}
                />
                <p className="approval-decision-impact approval-decision-impact--danger">
                  Design will be rejected.
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
                  placeholder="Describe what must be fixed…"
                  onEnterSubmit={enterSubmit}
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
                    onValueChange={(v) =>
                      onChange({
                        ...state,
                        routeSubProcessCode: v,
                        reworkAssigneeEmployeeId: "",
                      })
                    }
                    options={routeOptions}
                  />
                </div>
                <FormSelect
                  id="reworkAssigneeEmployeeId"
                  label="Rework assignee"
                  required
                  value={reworkAssigneeEmployeeId || null}
                  onValueChange={(v) => onChange({ ...state, reworkAssigneeEmployeeId: v })}
                  options={employeeOptions.map((e) => ({
                    value: String(e.id),
                    label: e.name,
                  }))}
                  placeholder="Who does the rework…"
                />
                {correctionType === "MISTAKE" ? (
                  <FormSelect
                    id="responsibleEmployeeId"
                    label="Responsible (KPI blame)"
                    required={false}
                    value={responsibleEmployeeId || null}
                    onValueChange={(v) => onChange({ ...state, responsibleEmployeeId: v })}
                    options={employeeOptions.map((e) => ({
                      value: String(e.id),
                      label: e.name,
                    }))}
                    placeholder="Defaults to rework assignee…"
                    hint="Defaults to rework assignee if blank."
                  />
                ) : null}
                <p className="approval-decision-impact approval-decision-impact--warn">
                  Assigns to{" "}
                  <strong>{correctionAssigneePreview ?? "stage assignee"}</strong> for{" "}
                  <strong>{routeSubProcessCode}</strong>.
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
    reworkAssigneeEmployeeId: "",
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
    !!state.routeSubProcessCode &&
    !!state.reworkAssigneeEmployeeId
  );
}
