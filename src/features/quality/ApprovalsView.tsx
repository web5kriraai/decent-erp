"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconClipboardCheck } from "@/components/icons";
import { DataTable } from "@/components/DataTable";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { ListPage } from "@/components/ui/ListPage";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatusBadge } from "@/components/StatusBadge";
import { TableIconActionGroup } from "@/components/ui/TableIconAction";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useClientList } from "@/hooks/use-client-list";
import { apiPost } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useEmployeeOptions } from "@/hooks/use-corrections";
import { parseApprovalRequestPackage } from "@/lib/approval-request-package";
import { canRoleAccessApprovalsHub, getApprovalHubTabsForRole } from "@/lib/stage-approval-rbac";
import type { PendingApprovalQueueItem } from "@/lib/types/api";

type ApprovalTab = "stage" | "ready" | "management";

type StageApprovalRow = {
  taskId: string;
  designId: string;
  ideaRef: string;
  collectionName: string;
  stageName: string;
  workStageName: string | null;
  status: string;
};

type ReadySignOffRow = {
  designId: string;
  ideaRef: string;
  collectionName: string;
  completedAt: string | null;
};

function isApprovalTab(value: string | null): value is ApprovalTab {
  return value === "stage" || value === "ready" || value === "management";
}

function TabCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="action-center-tab-count">{count}</span>;
}

function formatCompletedAt(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stageSearchText(row: StageApprovalRow) {
  return [row.ideaRef, row.collectionName, row.stageName, row.workStageName, row.status]
    .filter(Boolean)
    .join(" ");
}

function readySearchText(row: ReadySignOffRow) {
  return [row.ideaRef, row.collectionName, row.completedAt].filter(Boolean).join(" ");
}

function managementSearchText(row: PendingApprovalQueueItem) {
  return [
    row.design.ideaRef,
    row.design.collectionName,
    row.currentLevel.name,
    row.nextLevelName,
  ]
    .filter(Boolean)
    .join(" ");
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
  const toast = useApiToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
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

  const activeItems = useMemo(() => {
    if (activeTab === "ready") return readyItems;
    if (activeTab === "management") return managementItems;
    return stageItems;
  }, [activeTab, managementItems, readyItems, stageItems]);

  const getSearchText = useCallback(
    (row: StageApprovalRow | ReadySignOffRow | PendingApprovalQueueItem) => {
      if (activeTab === "ready") return readySearchText(row as ReadySignOffRow);
      if (activeTab === "management") return managementSearchText(row as PendingApprovalQueueItem);
      return stageSearchText(row as StageApprovalRow);
    },
    [activeTab],
  );

  const list = useClientList({
    items: activeItems,
    getSearchText,
    filterKey: activeTab,
  });

  if (!canAccessHub) {
    return (
      <div className="page-shell">
        <PermissionDenied message="Approvals hub is not available for your role. Open assigned approval tasks from My Tasks." />
      </div>
    );
  }

  const showTabChrome = visibleTabs.length > 1;

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

  async function handleBulkApprove() {
    const items = managementItems.filter((row) =>
      selectedIds.has(`${row.designId}-${row.currentLevel.id}`),
    );
    if (!items.length) return;
    setBulkPending(true);
    try {
      const response = await apiPost<{
        count: number;
        failedCount: number;
        failures?: Array<{ designId: string; error: string }>;
      }>("/api/approvals/bulk", {
        decision: "APPROVED",
        remark: "Bulk approved",
        items: items.map((row) => ({
          designId: row.designId,
          taskId: row.task?.id,
          approvalLevelId: row.currentLevel.id,
        })),
      });
      const failedCount = response.failedCount ?? 0;
      const okCount = response.count ?? 0;
      if (failedCount === 0) {
        toast.success(`Approved ${okCount} item(s)`);
        setSelectedIds(new Set());
      } else if (okCount === 0) {
        const first = response.failures?.[0]?.error;
        toast.error(
          first
            ? `Bulk approve failed: ${first}`
            : `Bulk approve failed for ${failedCount} item(s)`,
        );
      } else {
        toast.error(
          `Approved ${okCount} of ${okCount + failedCount}; ${failedCount} failed`,
        );
        setSelectedIds(new Set());
      }
      await hubQuery.refetch();
    } catch (e) {
      toast.errorFromApi(e, "Bulk approve failed");
    } finally {
      setBulkPending(false);
    }
  }

  const requestPackage = decideItem
    ? parseApprovalRequestPackage(decideItem.approvalRequestPackage)
    : null;

  const searchPlaceholder =
    activeTab === "stage"
      ? "Search stage approvals…"
      : activeTab === "ready"
        ? "Search ready designs…"
        : "Search management sign-offs…";

  function renderActiveTable() {
    if (activeTab === "ready") {
      const pageRows = list.pageItems as ReadySignOffRow[];
      return (
        <DataTable
          flush
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
          rows={pageRows}
          getRowKey={(row) => row.designId}
          emptyTitle="No designs ready to request management approval"
        />
      );
    }

    if (activeTab === "management") {
      const pageRows = list.pageItems as PendingApprovalQueueItem[];
      return (
        <DataTable
          flush
          columns={[
            {
              key: "select",
              header: "Sel",
              render: (row) => {
                const key = `${row.designId}-${row.currentLevel.id}`;
                return (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(key)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(key);
                        else next.delete(key);
                        return next;
                      });
                    }}
                  />
                );
              },
            },
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
          rows={pageRows}
          getRowKey={(row) => `${row.designId}-${row.currentLevel.id}`}
          emptyTitle="No management sign-offs waiting for you"
        />
      );
    }

    const pageRows = list.pageItems as StageApprovalRow[];
    return (
      <DataTable
        flush
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
            render: (row) => row.workStageName ?? "-",
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
        rows={pageRows}
        getRowKey={(row) => row.taskId}
        emptyTitle="No stage approvals waiting"
      />
    );
  }

  const tableContent = renderActiveTable();

  return (
    <ListPage
      title="Approvals"
        search={{
          value: list.search,
          onChange: list.setSearch,
          placeholder: searchPlaceholder,
          "aria-label": "Search approvals",
        }}
        toolbarExtra={
          activeTab === "management" ? (
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={!selectedIds.size || bulkPending}
              onClick={() => void handleBulkApprove()}
            >
              Approve Selected ({selectedIds.size})
            </AppButton>
          ) : undefined
        }
        onRefresh={() => hubQuery.refetch()}
        isRefreshing={hubQuery.isFetching}
        beforeTable={
          showTabChrome ? (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTab)}>
              <TabsList>
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
            </Tabs>
          ) : undefined
        }
        query={{
          isLoading: hubQuery.isLoading,
          isError: hubQuery.isError,
          error: hubQuery.error,
          onRetry: () => hubQuery.refetch(),
        }}
        pagination={{
          total: list.total,
          page: list.page,
          pageSize: list.pageSize,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
          pageSizeSelectId: `approvals-${activeTab}-page-size`,
        }}
        overlays={
          <Modal
            open={!!decideItem}
            title={decideItem ? `Decide ${decideItem.design.ideaRef}` : "Decide"}
            size="xl"
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
        }
      >
        {tableContent}
    </ListPage>
  );
}
