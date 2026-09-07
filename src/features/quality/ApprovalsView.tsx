"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconClipboardCheck } from "@/components/icons";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { TableIconActionGroup } from "@/components/ui/TableIconAction";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Modal,
  ModalFooterActions,
} from "@/components/ui/Modal";
import {
  ApprovalDecisionForm,
  defaultApprovalDecisionFormState,
  isApprovalDecisionFormValid,
  type ApprovalDecisionFormState,
} from "@/components/approvals/ApprovalDecisionForm";
import { ROUTES } from "@/config/routes";
import { resolveWorkOpenHref } from "@/lib/resolve-work-open-href";
import { useApprovalsHub, useSubmitApproval } from "@/hooks/use-approvals";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import { parseApprovalRequestPackage } from "@/lib/approval-request-package";
import { canRoleAccessApprovalsHub, getApprovalHubTabsForRole } from "@/lib/stage-approval-rbac";
import type { PendingApprovalQueueItem } from "@/lib/types/api";

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
  const [decideItem, setDecideItem] = useState<PendingApprovalQueueItem | null>(null);
  const [formState, setFormState] = useState<ApprovalDecisionFormState>(
    defaultApprovalDecisionFormState(),
  );
  const employeesQuery = useEmployeeOptions(!!decideItem);

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
    if (hubTabs.management && managementItems.length > 0) return "management";
    if (hubTabs.stage && stageItems.length > 0) return "stage";
    if (hubTabs.ready && readyItems.length > 0) return "ready";
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

  const isLoading = hubQuery.isLoading;
  const isError = hubQuery.isError;
  const error = hubQuery.error;
  const showTabChrome = visibleTabs.length > 1;

  function retryAll() {
    hubQuery.refetch();
  }

  async function handleManagementSubmit() {
    if (!decideItem || !isApprovalDecisionFormValid(formState, decideItem.costingReady)) return;
    const result = await submitApproval.mutateAsync({
      designId: decideItem.designId,
      taskId: decideItem.task?.id,
      approvalLevelId: decideItem.currentLevel.id,
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
    await hubQuery.refetch();
    if (result.nextLevel && !result.chainComplete) {
      const next = (hubQuery.data?.managementApprovals ?? []).find(
        (row) => row.designId === decideItem.designId,
      );
      if (next) {
        setDecideItem(next);
        return;
      }
    }
    setDecideItem(null);
  }

  const stagePanel = (
    <AppCard title={showTabChrome ? undefined : "Stage approvals"}>
      <DataTable
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => {
              const href =
                resolveWorkOpenHref({
                  taskId: row.taskId,
                  designId: row.designId,
                  intent: "task",
                }) ?? ROUTES.designs.detail(row.designId);
              return (
                <Link href={href} className="data-table-link">
                  {row.ideaRef}
                </Link>
              );
            },
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
            render: (row) => {
              const href =
                resolveWorkOpenHref({
                  taskId: row.taskId,
                  designId: row.designId,
                  intent: "task",
                }) ?? ROUTES.designs.detail(row.designId);
              return (
                <TableIconActionGroup>
                  <AppButtonLink
                    href={href}
                    appVariant="primary"
                    size="icon-sm"
                    className="table-icon-action"
                    title="Review"
                    aria-label="Review"
                  >
                    <IconClipboardCheck aria-hidden />
                  </AppButtonLink>
                </TableIconActionGroup>
              );
            },
          },
        ]}
        rows={stageItems}
        getRowKey={(row) => row.taskId}
        emptyTitle="No stage approvals waiting"
      />
    </AppCard>
  );

  const readyPanel = (
    <AppCard title={showTabChrome ? undefined : "Ready to request sign-off"}>
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
                <AppButtonLink
                  href={ROUTES.quality.requestSignOff(row.designId)}
                  appVariant="primary"
                  size="icon-sm"
                  className="table-icon-action"
                  title="Request management approval"
                  aria-label="Request management approval"
                >
                  <IconClipboardCheck aria-hidden />
                </AppButtonLink>
              </TableIconActionGroup>
            ),
          },
        ]}
        rows={readyItems}
        getRowKey={(row) => row.designId}
        emptyTitle="No designs ready to request management approval"
      />
    </AppCard>
  );

  const managementPanel = (
    <AppCard title={showTabChrome ? undefined : "Management sign-off"}>
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
            header: "Your level",
            render: (row) => row.currentLevel.name,
          },
          {
            key: "next",
            header: "Next",
            render: (row) => row.nextLevelName ?? "Final",
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (row) => (
              <TableIconActionGroup>
                <AppButton
                  type="button"
                  appVariant="primary"
                  size="icon-sm"
                  className="table-icon-action"
                  title="Decide"
                  aria-label="Decide"
                  onClick={() => {
                    setFormState(defaultApprovalDecisionFormState());
                    setDecideItem(row);
                  }}
                >
                  <IconClipboardCheck aria-hidden />
                </AppButton>
              </TableIconActionGroup>
            ),
          },
        ]}
        rows={managementItems}
        getRowKey={(row) => `${row.designId}-${row.currentLevel.id}`}
        emptyTitle="No management sign-offs waiting for you"
      />
    </AppCard>
  );

  function panelForTab(tab: ApprovalTab) {
    if (tab === "ready") return readyPanel;
    if (tab === "management") return managementPanel;
    return stagePanel;
  }

  const requestPackage = decideItem
    ? parseApprovalRequestPackage(decideItem.approvalRequestPackage)
    : null;

  return (
    <div className="page-shell">
      <PageHeader title="Approvals" />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={retryAll}
        skeletonVariant="table"
      >
        {showTabChrome ? (
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
                  Ready to request
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

            {hubTabs.stage ? <TabsContent value="stage">{stagePanel}</TabsContent> : null}
            {hubTabs.ready ? <TabsContent value="ready">{readyPanel}</TabsContent> : null}
            {hubTabs.management ? (
              <TabsContent value="management">{managementPanel}</TabsContent>
            ) : null}
          </Tabs>
        ) : (
          panelForTab(activeTab)
        )}
      </QueryState>

      <Modal
        open={!!decideItem}
        title={decideItem ? `Decide ${decideItem.design.ideaRef}` : "Decide"}
        size="lg"
        onClose={() => setDecideItem(null)}
        footer={
          <ModalFooterActions>
            <AppButton type="button" appVariant="outline" onClick={() => setDecideItem(null)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              disabled={
                !decideItem ||
                submitApproval.isPending ||
                !isApprovalDecisionFormValid(formState, decideItem.costingReady)
              }
              onClick={() => void handleManagementSubmit()}
            >
              {submitApproval.isPending ? "Submitting…" : "Submit Decision"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {decideItem ? (
          <ApprovalDecisionForm
            designId={decideItem.designId}
            requestPackage={requestPackage}
            costingReady={decideItem.costingReady}
            decisionOptions={[
              ...(decideItem.costingReady !== false
                ? [{ value: "APPROVED" as const, label: "Approve" }]
                : []),
              { value: "REJECTED", label: "Reject" },
              { value: "CORRECTION_REQUIRED", label: "Send for Correction" },
            ]}
            state={formState}
            onChange={setFormState}
            stageAssignees={decideItem.stageAssignees}
            employeeOptions={(employeesQuery.data ?? []).map((e) => ({
              id: e.id,
              name: e.name,
            }))}
            nextLevelName={decideItem.nextLevelName}
            onEnterSubmit={() => void handleManagementSubmit()}
          />
        ) : null}
      </Modal>
    </div>
  );
}
