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
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
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
import { canRoleAccessApprovalsHub, getApprovalHubTabsForRole, getStageApprovalOwnerRole } from "@/lib/stage-approval-rbac";
import { hasAssignManualPermission, PERMISSIONS } from "@/lib/permissions";
import { useAssignTask } from "@/hooks/use-tasks";
import type { PendingApprovalQueueItem } from "@/lib/types/api";

function DesignNameCell({
  name,
  ideaRef,
  href,
}: {
  name: string;
  ideaRef: string;
  href: string;
}) {
  return (
    <Link href={href} className="concept-board-design">
      <span className="concept-board-line">
        <span className="concept-board-line__title data-table-link">{name}</span>
        <span className="data-table-subtext concept-board-line__meta">{ideaRef}</span>
      </span>
    </Link>
  );
}

type ApprovalTab = "stage" | "ready" | "management";

type StageApprovalRow = {
  taskId: string;
  designId: string;
  ideaRef: string;
  collectionName: string;
  stageName: string;
  stageCode: string;
  assigneeName: string | null;
  ownerRoleCode?: string | null;
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
  return [row.ideaRef, row.collectionName, row.stageName, row.assigneeName, row.workStageName, row.status]
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

function StageAssignModal({
  row,
  employees,
  employeeId,
  onEmployeeId,
  pending,
  onClose,
  onAssign,
}: {
  row: StageApprovalRow | null;
  employees: Array<{ id: number; name: string; role: { code: string; name: string } }>;
  employeeId: string | null;
  onEmployeeId: (value: string | null) => void;
  pending: boolean;
  onClose: () => void;
  onAssign: () => Promise<void>;
}) {
  const ownerRole = row ? getStageApprovalOwnerRole(row.stageCode, row.ownerRoleCode) : null;
  const options = employees.filter((employee) => !ownerRole || employee.role.code === ownerRole);
  return (
    <Modal
      open={!!row}
      title={row ? `Assign ${row.stageName}` : "Assign"}
      size="sm"
      onClose={onClose}
      footer={
        <ModalFooterActions>
          <AppButton type="button" appVariant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </AppButton>
          <AppButton
            type="button"
            appVariant="primary"
            disabled={pending || !employeeId}
            onClick={() => void onAssign()}
          >
            {pending ? "Assigning…" : "Assign"}
          </AppButton>
        </ModalFooterActions>
      }
    >
      {row ? (
        <ModalForm>
          <p className="m-0 text-sm">
            {row.collectionName} needs a person for {row.stageName}. The list is only people who hold that stage role.
          </p>
          <FormSelect
            id="stage-assign-employee"
            label="Person"
            required
            value={employeeId}
            onValueChange={onEmployeeId}
            placeholder={options.length ? "Choose a person…" : "No one in this role"}
            options={options.map((employee) => ({
              value: String(employee.id),
              label: employee.name,
            }))}
          />
        </ModalForm>
      ) : null}
    </Modal>
  );
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
  const permissions = session?.user?.permissions ?? [];
  const canAssign =
    hasAssignManualPermission(permissions) ||
    permissions.includes(PERMISSIONS.DESIGN_REASSIGN);
  const [assignRow, setAssignRow] = useState<StageApprovalRow | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState<string | null>(null);
  const assignTask = useAssignTask();
  const employeesQuery = useEmployeeOptions(!!decideItem || !!assignRow);

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
                <DesignNameCell
                  name={row.collectionName}
                  ideaRef={row.ideaRef}
                  href={ROUTES.designs.detail(row.designId)}
                />
              ),
            },
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
          emptyTitle="No finished design is waiting to be sent"
          emptyDescription="A design appears here after Final Approval. It stays here until someone sends it to Management."
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
                <DesignNameCell
                  name={row.design.collectionName}
                  ideaRef={row.design.ideaRef}
                  href={ROUTES.designs.detail(row.designId)}
                />
              ),
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
          emptyTitle="Nothing is with Management yet"
          emptyDescription="Finished designs stay under Send to Management until they are sent. Production starts after Management approves."
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
                <DesignNameCell name={row.collectionName} ideaRef={row.ideaRef} href={href} />
              );
            },
          },
          { key: "stage", header: "Stage", render: (row) => row.stageName },
          {
            key: "assignee",
            header: "With",
            render: (row) => {
              if (row.assigneeName) return row.assigneeName;
              if (!canAssign) return "Not assigned";
              return (
                <AppButton
                  type="button"
                  appVariant="outline"
                  size="sm"
                  onClick={() => {
                    setAssignEmployeeId(null);
                    setAssignRow(row);
                  }}
                >
                  Assign person
                </AppButton>
              );
            },
          },
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
        emptyTitle="No stage check is waiting"
        emptyDescription="These are decisions while a design is still being made: concept, sketch, sample, and final approval."
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
          <div className="approval-guide-wrap">
            <div className="approval-guide" role="tablist" aria-label="Approval steps">
              {(
                [
                  hubTabs.stage
                    ? {
                        id: "stage" as const,
                        title: "Stage checks",
                        text: "While the design is being made",
                        count: stageItems.length,
                      }
                    : null,
                  hubTabs.ready
                    ? {
                        id: "ready" as const,
                        title: "Send to Management",
                        text: "Finished work, not sent yet",
                        count: readyItems.length,
                      }
                    : null,
                  hubTabs.management
                    ? {
                        id: "management" as const,
                        title: "Management decision",
                        text: "Approve, send back, or reject",
                        count: managementItems.length,
                      }
                    : null,
                ].filter((step) => step != null)
              ).map((step, index) => {
                const selected = activeTab === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={selected ? "approval-guide-card is-current" : "approval-guide-card"}
                    onClick={() => setActiveTab(step.id)}
                  >
                    <span className="approval-guide-step">{index + 1}</span>
                    <span className="approval-guide-copy">
                      <span className="approval-guide-title">
                        {step.title}
                        <TabCountBadge count={step.count} />
                      </span>
                      <span className="approval-guide-text">{step.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="approval-guide-note">
              {activeTab === "ready"
                ? "These designs finished every stage. Send one to Management. It is not in Stage checks."
                : activeTab === "management"
                  ? "Management decides here. Production starts after an approval."
                  : "These are concept, sketch, sample, and final approval while work is still going."}
            </p>
          </div>
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
          <>
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
          <StageAssignModal
            row={assignRow}
            employees={employeesQuery.data ?? []}
            employeeId={assignEmployeeId}
            onEmployeeId={setAssignEmployeeId}
            pending={assignTask.isPending}
            onClose={() => {
              setAssignRow(null);
              setAssignEmployeeId(null);
            }}
            onAssign={async () => {
              if (!assignRow || !assignEmployeeId) return;
              await assignTask.mutateAsync({
                taskId: assignRow.taskId,
                employeeId: Number(assignEmployeeId),
              });
              setAssignRow(null);
              setAssignEmployeeId(null);
            }}
          />
          </>
        }
      >
        {tableContent}
    </ListPage>
  );
}
