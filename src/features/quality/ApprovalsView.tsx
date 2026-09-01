"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import {
  resolveApprovalContextActions,
  WORKFLOW_ACTION_CODES,
  type ResolvedWorkflowAction,
} from "@/lib/workflow-actions";
import {
  usePendingApprovals,
  useReadyForSignOff,
  useRequestDesignApproval,
  useStageApprovals,
  useSubmitApproval,
  type PendingApprovalItem,
} from "@/hooks/use-approvals";
import { PERMISSIONS } from "@/lib/permissions";

type ApprovalTab = "stage" | "ready" | "management";

const TAB_ORDER: ApprovalTab[] = ["stage", "ready", "management"];

function isApprovalTab(value: string | null): value is ApprovalTab {
  return value === "stage" || value === "ready" || value === "management";
}

function TabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count}
    </span>
  );
}

function formatCompletedAt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ApprovalsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canApprove = permissions.includes(PERMISSIONS.DESIGN_APPROVE);

  const stageQuery = useStageApprovals(canApprove);
  const readyQuery = useReadyForSignOff(canApprove);
  const pendingQuery = usePendingApprovals(canApprove);
  const submitApproval = useSubmitApproval();
  const requestApproval = useRequestDesignApproval();

  const [selected, setSelected] = useState<PendingApprovalItem | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "CORRECTION_REQUIRED">(
    "APPROVED",
  );
  const [remark, setRemark] = useState("");
  const [requestingDesignId, setRequestingDesignId] = useState<string | null>(null);

  const stageItems = stageQuery.data ?? [];
  const readyItems = readyQuery.data ?? [];
  const managementItems = pendingQuery.data ?? [];

  const defaultTab = useMemo<ApprovalTab>(() => {
    if (stageItems.length > 0) return "stage";
    if (readyItems.length > 0) return "ready";
    if (managementItems.length > 0) return "management";
    return "stage";
  }, [stageItems.length, readyItems.length, managementItems.length]);

  const tabParam = searchParams.get("tab");
  const activeTab: ApprovalTab = isApprovalTab(tabParam) ? tabParam : defaultTab;

  useEffect(() => {
    if (!isApprovalTab(tabParam)) {
      router.replace(`${ROUTES.quality.approvals}?tab=${defaultTab}`, { scroll: false });
    }
  }, [tabParam, defaultTab, router]);

  function setActiveTab(tab: ApprovalTab) {
    router.replace(`${ROUTES.quality.approvals}?tab=${tab}`, { scroll: false });
  }

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

  async function handleRequestApproval(designId: string) {
    setRequestingDesignId(designId);
    try {
      await requestApproval.mutateAsync(designId);
      setActiveTab("management");
    } finally {
      setRequestingDesignId(null);
    }
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

  const isLoading = stageQuery.isLoading || readyQuery.isLoading || pendingQuery.isLoading;
  const isError = stageQuery.isError || readyQuery.isError || pendingQuery.isError;
  const error = stageQuery.error ?? readyQuery.error ?? pendingQuery.error;

  function retryAll() {
    stageQuery.refetch();
    readyQuery.refetch();
    pendingQuery.refetch();
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Approvals"
        subtitle="Workflow stage reviews, ready-for-sign-off designs, and management sign-off"
      />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={retryAll}
        skeletonVariant="table"
      >
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTab)}>
          <TabsList className="mb-4">
            {TAB_ORDER.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab === "stage" && (
                  <>
                    Stage approvals
                    <TabCountBadge count={stageItems.length} />
                  </>
                )}
                {tab === "ready" && (
                  <>
                    Ready for sign-off
                    <TabCountBadge count={readyItems.length} />
                  </>
                )}
                {tab === "management" && (
                  <>
                    Management sign-off
                    <TabCountBadge count={managementItems.length} />
                  </>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="stage">
            <div className="card">
              <DataTable
                columns={[
                  {
                    key: "design",
                    header: "Design",
                    render: (row) => (
                      <Link href={ROUTES.designs.detail(row.designId)} className="data-table-link">
                        {row.ideaRef}
                      </Link>
                    ),
                  },
                  { key: "collection", header: "Collection", render: (row) => row.collectionName },
                  { key: "stage", header: "Stage", render: (row) => row.stageName },
                  {
                    key: "work",
                    header: "Work submitted",
                    render: (row) => row.workStageName ?? "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <Link
                        href={ROUTES.designs.detail(row.designId)}
                        className="btn btn-primary btn-sm"
                      >
                        Review
                      </Link>
                    ),
                  },
                ]}
                rows={stageItems}
                getRowKey={(row) => row.taskId}
                emptyTitle="No stage approvals waiting"
                emptyDescription="When sketch, punch, sample check, or costing work is submitted, the approval task appears here for your review."
              />
            </div>
          </TabsContent>

          <TabsContent value="ready">
            <div className="card">
              <DataTable
                columns={[
                  {
                    key: "design",
                    header: "Design",
                    render: (row) => (
                      <Link href={ROUTES.designs.detail(row.designId)} className="data-table-link">
                        {row.ideaRef}
                      </Link>
                    ),
                  },
                  { key: "collection", header: "Collection", render: (row) => row.collectionName },
                  {
                    key: "completed",
                    header: "Workflow completed",
                    render: (row) => formatCompletedAt(row.completedAt),
                  },
                  {
                    key: "actions",
                    header: "",
                    align: "right",
                    render: (row) => (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={
                          requestApproval.isPending && requestingDesignId === row.designId
                        }
                        onClick={() => handleRequestApproval(row.designId)}
                      >
                        {requestApproval.isPending && requestingDesignId === row.designId
                          ? "Submitting…"
                          : "Request approval"}
                      </button>
                    ),
                  },
                ]}
                rows={readyItems}
                getRowKey={(row) => row.designId}
                emptyTitle="No designs ready for sign-off"
                emptyDescription="When all workflow stages are complete, designs appear here so you can submit them to the management approval chain."
              />
            </div>
          </TabsContent>

          <TabsContent value="management">
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
                  {
                    key: "collection",
                    header: "Collection",
                    render: (row) => row.design.collectionName,
                  },
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
                        : "—",
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
                rows={managementItems}
                getRowKey={(row) => `${row.designId}-${row.currentLevel.id}`}
                emptyTitle="No management sign-offs waiting"
                emptyDescription="After you request final approval, designs enter the checker → design head → management chain and appear here at your level."
              />
            </div>
          </TabsContent>
        </Tabs>
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
