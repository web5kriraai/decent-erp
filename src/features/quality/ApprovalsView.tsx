"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextArea } from "@/components/ui/form-text-area";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { ROUTES } from "@/config/routes";
import {
  resolveApprovalContextActions,
  WORKFLOW_ACTION_CODES,
  type ResolvedWorkflowAction,
} from "@/lib/workflow-actions";
import {
  usePendingApprovals,
  useSubmitApproval,
  type PendingApprovalItem,
} from "@/hooks/use-approvals";
import { PERMISSIONS } from "@/lib/permissions";

export function ApprovalsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canApprove = permissions.includes(PERMISSIONS.DESIGN_APPROVE);

  const pendingQuery = usePendingApprovals(canApprove);
  const submitApproval = useSubmitApproval();

  const [selected, setSelected] = useState<PendingApprovalItem | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "CORRECTION_REQUIRED">(
    "APPROVED",
  );
  const [remark, setRemark] = useState("");

  if (!canApprove) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_APPROVE} />
      </div>
    );
  }

  async function handleSubmit() {
    if (!selected) return;
    await submitApproval.mutateAsync({
      designId: selected.designId,
      taskId: selected.task?.id,
      approvalLevelId: selected.currentLevel.id,
      decision,
      remark: remark.trim() || undefined,
    });
    setSelected(null);
    setRemark("");
  }

  function handleApprovalAction(action: ResolvedWorkflowAction) {
    if (!selected) return;
    if (action.code === WORKFLOW_ACTION_CODES.APPROVE_LEVEL) setDecision("APPROVED");
    if (action.code === WORKFLOW_ACTION_CODES.REJECT_LEVEL) setDecision("REJECTED");
    if (action.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL_CORRECTION) {
      setDecision("CORRECTION_REQUIRED");
    }
  }

  const approvalActions = selected
    ? resolveApprovalContextActions({ item: selected, permissions })
    : [];

  return (
    <div className="page-shell">
      <PageHeader
        title="Approvals"
        subtitle="Multi-level approval chain for design stages"
      />

      <QueryState
        isLoading={pendingQuery.isLoading}
        isError={pendingQuery.isError}
        error={pendingQuery.error}
        onRetry={() => pendingQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card">
          <DataTable
            columns={[
              {
                key: "design",
                header: "Design",
                render: (row) => (
                  <Link href={ROUTES.designs.detail(row.designId)} className="data-table-link">
                    {row.design.ideaRef}
                  </Link>
                ),
              },
              { key: "collection", header: "Collection", render: (row) => row.design.collectionName },
              {
                key: "level",
                header: "Current Level",
                render: (row) => row.currentLevel.name,
              },
              {
                key: "task",
                header: "Related Task",
                render: (row) =>
                  row.task
                    ? `${row.task.process.name} → ${row.task.subProcess.name}`
                    : "-",
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSelected(row);
                      setDecision("APPROVED");
                      setRemark("");
                    }}
                  >
                    Review
                  </button>
                ),
              },
            ]}
            rows={pendingQuery.data ?? []}
            getRowKey={(row) => `${row.designId}-${row.currentLevel.id}`}
            emptyTitle="No pending approvals"
            emptyDescription="Designs awaiting sign-off will appear here when submitted for approval."
          />
        </div>
      </QueryState>

      <Modal
        open={!!selected}
        title={selected ? `Approve ${selected.design.ideaRef}` : "Approval"}
        description={
          selected
            ? `Review and submit your decision for approval level: ${selected.currentLevel.name}.`
            : undefined
        }
        onClose={() => setSelected(null)}
        footer={
          <ModalFooterActions>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={submitApproval.isPending}
              onClick={handleSubmit}
            >
              {submitApproval.isPending ? "Submitting…" : "Submit Decision"}
            </Button>
          </ModalFooterActions>
        }
      >
        {selected && (
          <ModalForm>
            <ContextualActionsPanel
              title="Decision actions"
              actions={approvalActions}
              onAction={handleApprovalAction}
              showDisabled={false}
            />
            <FormSelect
              id="approvalDecision"
              label="Decision"
              required
              value={decision}
              onValueChange={(v) => setDecision(v as typeof decision)}
              options={[
                { value: "APPROVED", label: "Approve" },
                { value: "REJECTED", label: "Reject" },
                { value: "CORRECTION_REQUIRED", label: "Send for Correction" },
              ]}
            />
            <FormTextArea
              id="approvalRemark"
              label="Remark"
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional notes for the design team…"
            />
          </ModalForm>
        )}
      </Modal>
    </div>
  );
}
