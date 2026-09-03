"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ClipboardCheck } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import {
  Modal,
  ModalFooterActions,
} from "@/components/ui/Modal";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import {
  useApprovalsHub,
  useSubmitApproval,
  type PendingApprovalItem,
} from "@/hooks/use-approvals";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import { canRoleAccessApprovalsHub, getApprovalHubTabsForRole } from "@/lib/stage-approval-rbac";
import { resolveApprovalContextActions, WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions";
import { parseApprovalRequestPackage } from "@/lib/approval-request-package";
import {
  ApprovalDecisionForm,
  defaultApprovalDecisionFormState,
  isApprovalDecisionFormValid,
  type ApprovalDecisionFormState,
} from "@/components/approvals/ApprovalDecisionForm";
import { RequestSignOffModal } from "@/components/approvals/RequestSignOffModal";

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
  const permissions = session?.user?.permissions ?? [];
  const hubTabs = getApprovalHubTabsForRole(roleCode);
  const canAccessHub = canRoleAccessApprovalsHub(roleCode);

  const hubQuery = useApprovalsHub(canAccessHub);
  const submitApproval = useSubmitApproval();
  const employeesQuery = useEmployeeOptions(canAccessHub);

  const [selected, setSelected] = useState<PendingApprovalItem | null>(null);
  const [formState, setFormState] = useState<ApprovalDecisionFormState>(
    defaultApprovalDecisionFormState(),
  );
  const [signOffDesign, setSignOffDesign] = useState<{ id: string; ideaRef: string } | null>(null);

  const selectedApprovalActions = useMemo(
    () =>
      selected
        ? resolveApprovalContextActions({
            permissions,
            roleCode,
            canAccessHub,
            approval: {
              designId: selected.designId,
              costingReady: selected.costingReady,
              levelName: selected.currentLevel.name,
            },
          })
        : [],
    [canAccessHub, permissions, roleCode, selected],
  );

  const decisionOptions = useMemo(() => {
    const options: Array<{ value: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED"; label: string }> =
      [];
    if (selectedApprovalActions.some((a) => a.code === WORKFLOW_ACTION_CODES.APPROVE_LEVEL)) {
      options.push({ value: "APPROVED", label: "Approve" });
    }
    if (selectedApprovalActions.some((a) => a.code === WORKFLOW_ACTION_CODES.REJECT_LEVEL)) {
      options.push({ value: "REJECTED", label: "Reject" });
    }
    if (
      selectedApprovalActions.some(
        (a) => a.code === WORKFLOW_ACTION_CODES.REQUEST_APPROVAL_CORRECTION,
      )
    ) {
      options.push({ value: "CORRECTION_REQUIRED", label: "Send for Correction" });
    }
    return options;
  }, [selectedApprovalActions]);

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
    if (!isApprovalDecisionFormValid(formState, selected.costingReady)) return;

    const designId = selected.designId;
    const result = await submitApproval.mutateAsync({
      designId,
      taskId: selected.task?.id,
      approvalLevelId: selected.currentLevel.id,
      decision: formState.decision,
      remark: formState.remark.trim() || undefined,
      correctionType:
        formState.decision === "CORRECTION_REQUIRED" ? formState.correctionType : undefined,
      routeSubProcessCode:
        formState.decision === "CORRECTION_REQUIRED" ? formState.routeSubProcessCode : undefined,
      responsibleEmployeeId:
        formState.decision === "CORRECTION_REQUIRED" && formState.responsibleEmployeeId
          ? Number(formState.responsibleEmployeeId)
          : undefined,
    });

    setFormState(defaultApprovalDecisionFormState());

    if (result.nextLevel && !result.chainComplete) {
      const refreshed = await hubQuery.refetch();
      const nextItem = refreshed.data?.managementApprovals?.find((item) => item.designId === designId);
      if (nextItem) {
        setSelected(nextItem);
        return;
      }
    }

    setSelected(null);
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
                        <TableIconActionGroup>
                          <AppButtonLink
                            href={ROUTES.designs.detail(row.designId)}
                            appVariant="primary"
                            size="icon-sm"
                            className="table-icon-action"
                            title="Review"
                            aria-label="Review"
                          >
                            <ClipboardCheck aria-hidden />
                          </AppButtonLink>
                        </TableIconActionGroup>
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
                        <TableIconActionGroup>
                          <TableIconAction
                            action="requestApproval"
                            label="Request Management Sign-off"
                            onClick={() =>
                              setSignOffDesign({ id: row.designId, ideaRef: row.ideaRef })
                            }
                          />
                        </TableIconActionGroup>
                      ),
                    },
                  ]}
                  rows={readyItems}
                  getRowKey={(row) => row.designId}
                  emptyTitle="No designs ready for sign-off"
                  emptyDescription="Only Design Head can request management sign-off. When all workflow stages are complete, designs appear here."
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
                        <TableIconActionGroup>
                          <TableIconAction
                            action="review"
                            onClick={() => {
                              setSelected(row);
                              setFormState(defaultApprovalDecisionFormState());
                            }}
                          />
                        </TableIconActionGroup>
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
        title={selected ? `Decide ${selected.design.ideaRef}` : "Approval"}
        description={
          selected
            ? `Review the requester package and submit your decision for ${selected.currentLevel.name}.`
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
              disabled={
                submitApproval.isPending ||
                decisionOptions.length === 0 ||
                !selected ||
                !isApprovalDecisionFormValid(formState, selected.costingReady)
              }
              onClick={() => void handleSubmit()}
            >
              {submitApproval.isPending ? "Submitting…" : "Submit Decision"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {selected ? (
          <ApprovalDecisionForm
            designId={selected.designId}
            requestPackage={parseApprovalRequestPackage(selected.approvalRequestPackage)}
            costingReady={selected.costingReady}
            decisionOptions={decisionOptions}
            state={formState}
            onChange={setFormState}
            stageAssignees={selected.stageAssignees}
            employeeOptions={(employeesQuery.data ?? []).map((e) => ({
              id: e.id,
              name: e.name,
            }))}
            nextLevelName={selected.nextLevelName}
          />
        ) : null}
      </Modal>

      <RequestSignOffModal
        open={!!signOffDesign}
        designId={signOffDesign?.id ?? ""}
        ideaRef={signOffDesign?.ideaRef}
        onClose={() => setSignOffDesign(null)}
        onSuccess={() => {
          if (hubTabs.management) setActiveTab("management");
        }}
      />
    </div>
  );
}
