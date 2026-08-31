"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { ROUTES } from "@/config/routes";
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
        onClose={() => setSelected(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitApproval.isPending}
              onClick={handleSubmit}
            >
              Submit Decision
            </button>
          </>
        }
      >
        {selected && (
          <>
            <p style={{ color: "var(--color-neutral-600)", marginTop: 0 }}>
              Level: <strong>{selected.currentLevel.name}</strong>
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="approvalDecision">
                Decision *
              </label>
              <select
                id="approvalDecision"
                className="form-select"
                value={decision}
                onChange={(e) =>
                  setDecision(e.target.value as typeof decision)
                }
              >
                <option value="APPROVED">Approve</option>
                <option value="REJECTED">Reject</option>
                <option value="CORRECTION_REQUIRED">Send for Correction</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="approvalRemark">
                Remark
              </label>
              <textarea
                id="approvalRemark"
                className="form-textarea"
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
