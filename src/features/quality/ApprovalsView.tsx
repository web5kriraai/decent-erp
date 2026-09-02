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
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import {
  useApprovalsHub,
  useRequestDesignApproval,
  useSubmitApproval,
  type PendingApprovalItem,
} from "@/hooks/use-approvals";
import { canRoleAccessApprovalsHub, getApprovalHubTabsForRole } from "@/lib/stage-approval-rbac";

type ApprovalTab = "stage" | "ready" | "management";

function isApprovalTab(value: string | null): value is ApprovalTab {
  return value === "stage" || value === "ready" || value === "management";
}

function TabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="action-center-tab-count">{count}</span>;
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
  const roleCode = session?.user?.roleCode;
  const hubTabs = getApprovalHubTabsForRole(roleCode);
  const canAccessHub = canRoleAccessApprovalsHub(roleCode);

  const hubQuery = useApprovalsHub(canAccessHub);
  const submitApproval = useSubmitApproval();
  const requestApproval = useRequestDesignApproval();

  const [selected, setSelected] = useState<PendingApprovalItem | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | "CORRECTION_REQUIRED">(
    "APPROVED",
  );
  const [remark, setRemark] = useState("");
  const [requestingDesignId, setRequestingDesignId] = useState<string | null>(null);

  const stageItems = hubQuery.data?.stageApprovals ?? [];
  const readyItems = hubQuery.data?.readyForSignOff ?? [];
  const managementItems = hubQuery.data?.managementApprovals ?? [];

  const visibleTabs = useMemo(() => {
    const tabs: ApprovalTab[] = [];
    if (hubTabs.stage) tabs.push("stage");
    if (hubTabs.ready) tabs.push("ready");
    if (hubTabs.management) tabs.push("management");
    return tabs;
  }, [hubTabs.management, hubTabs.ready, hubTabs.stage]);

  const defaultTab = useMemo<ApprovalTab>(() => {
    if (hubTabs.stage && stageItems.length > 0) return "stage";
    if (hubTabs.ready && readyItems.length > 0) return "ready";
    if (hubTabs.management && managementItems.length > 0) return "management";
    return visibleTabs[0] ?? "stage";
  }, [
    hubTabs.management,
    hubTabs.ready,
    hubTabs.stage,
    managementItems.length,
    readyItems.length,
    stageItems.length,
    visibleTabs,
  ]);

  const tabParam = searchParams.get("tab");
  const activeTab: ApprovalTab =
    isApprovalTab(tabParam) && visibleTabs.includes(tabParam) ? tabParam : defaultTab;

  useEffect(() => {
    if (!canAccessHub) return;
    if (!isApprovalTab(tabParam) || !visibleTabs.includes(tabParam)) {
      router.replace(`${ROUTES.quality.approvals}?tab=${defaultTab}`, { scroll: false });
    }
  }, [canAccessHub, defaultTab, router, tabParam, visibleTabs]);

  function setActiveTab(tab: ApprovalTab) {
    router.replace(`${ROUTES.quality.approvals}?tab=${tab}`, { scroll: false });
  }

  if (!canAccessHub) {
    return (
      <div className="page-shell">
        <PermissionDenied message="Approvals hub is not available for your role. Open assigned approval tasks from My Tasks." />
      </div>
    );
  }

  async function handleSubmit() {
    if (!selected) return;
    if (decision !== "APPROVED" && !remark.trim()) return;
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
      if (hubTabs.management) setActiveTab("management");
    } finally {
      setRequestingDesignId(null);
    }
  }

  const isLoading = hubQuery.isLoading;
  const isError = hubQuery.isError;
  const error = hubQuery.error;

  function retryAll() {
    hubQuery.refetch();
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
            {hubTabs.stage ? (
              <TabsTrigger value="stage" className="action-center-tab-trigger">
                Stage approvals
                <TabCountBadge count={stageItems.length} />
              </TabsTrigger>
            ) : null}
            {hubTabs.ready ? (
              <TabsTrigger value="ready" className="action-center-tab-trigger">
                Ready for sign-off
                <TabCountBadge count={readyItems.length} />
              </TabsTrigger>
            ) : null}
            {hubTabs.management ? (
              <TabsTrigger value="management" className="action-center-tab-trigger">
                Management sign-off
                <TabCountBadge count={managementItems.length} />
              </TabsTrigger>
            ) : null}
          </TabsList>

          {hubTabs.stage ? (
            <TabsContent value="stage">
              <AppCard>
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
                        <AppButtonLink
                          href={ROUTES.designs.detail(row.designId)}
                          appVariant="primary"
                          size="sm"
                        >
                          Review
                        </AppButtonLink>
                      ),
                    },
                  ]}
                  rows={stageItems}
                  getRowKey={(row) => row.taskId}
                  emptyTitle="No stage approvals waiting"
                  emptyDescription="When work is submitted for your review stage, the approval task appears here."
                />
              </AppCard>
            </TabsContent>
          ) : null}

          {hubTabs.ready ? (
            <TabsContent value="ready">
              <AppCard>
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
                        <AppButton
                          type="button"
                          appVariant="primary"
                          size="sm"
                          disabled={
                            requestApproval.isPending && requestingDesignId === row.designId
                          }
                          onClick={() => handleRequestApproval(row.designId)}
                        >
                          {requestApproval.isPending && requestingDesignId === row.designId
                            ? "Submitting…"
                            : "Request approval"}
                        </AppButton>
                      ),
                    },
                  ]}
                  rows={readyItems}
                  getRowKey={(row) => row.designId}
                  emptyTitle="No designs ready for sign-off"
                  emptyDescription="When all workflow stages are complete, designs appear here so you can submit them to the management approval chain."
                />
              </AppCard>
            </TabsContent>
          ) : null}

          {hubTabs.management ? (
            <TabsContent value="management">
              <AppCard>
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
                        <AppButton
                          type="button"
                          appVariant="primary"
                          size="sm"
                          onClick={() => {
                            setSelected(row);
                            setDecision("APPROVED");
                            setRemark("");
                          }}
                        >
                          Review
                        </AppButton>
                      ),
                    },
                  ]}
                  rows={managementItems}
                  getRowKey={(row) => `${row.designId}-${row.currentLevel.id}`}
                  emptyTitle="No management sign-offs waiting"
                  emptyDescription="Designs at your management approval level appear here after final approval is requested."
                />
              </AppCard>
            </TabsContent>
          ) : null}
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
            <AppButton type="button" appVariant="outline" onClick={() => setSelected(null)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              appVariant="primary"
              disabled={submitApproval.isPending || (decision !== "APPROVED" && !remark.trim())}
              onClick={handleSubmit}
            >
              {submitApproval.isPending ? "Submitting…" : "Submit Decision"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {selected && (
          <ModalForm>
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
              required={decision !== "APPROVED"}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={
                decision === "APPROVED"
                  ? "Optional notes for the design team…"
                  : "Required — explain why this was rejected or sent back…"
              }
            />
          </ModalForm>
        )}
      </Modal>
    </div>
  );
}
