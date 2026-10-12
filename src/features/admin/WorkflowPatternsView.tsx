"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useWorkflowPatterns } from "@/hooks/use-masters";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { Modal, ModalAlert, ModalFooterActions } from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { CreateWorkflowPatternModal } from "@/features/admin/CreateWorkflowPatternModal";
import { useClientList } from "@/hooks/use-client-list";
import type { CreateWorkflowPatternPayload, WorkflowPattern } from "@/lib/types/api";

type WorkflowPatternUsage = {
  blocked: boolean;
  total: number;
  designs: Array<{
    id: string;
    ideaRef: string;
    designNumber: string | null;
    collectionName: string;
    status: string;
  }>;
};

function designStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function OpenDesignList({ usage }: { usage: WorkflowPatternUsage }) {
  return (
    <div className="space-y-2">
      <ModalAlert variant="warning">
        {usage.total === 1
          ? "1 design is still using this workflow. Complete it before making the pattern inactive."
          : `${usage.total} designs are still using this workflow. Complete them before making the pattern inactive.`}
      </ModalAlert>
      <ul className="max-h-60 divide-y divide-border overflow-auto rounded-md border border-border">
        {usage.designs.map((design) => (
          <li key={design.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">{design.collectionName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {design.designNumber ?? design.ideaRef}
              </p>
            </div>
            <StatusBadge status={design.status} label={designStatusLabel(design.status)} />
          </li>
        ))}
      </ul>
      {usage.total > usage.designs.length ? (
        <p className="text-xs text-muted-foreground">
          And {usage.total - usage.designs.length} more.
        </p>
      ) : null}
    </div>
  );
}

type StatusFilter = "all" | "active" | "inactive";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function patternSearchText(row: WorkflowPattern) {
  return `${row.name} ${row.productType?.name ?? ""}`;
}

export function WorkflowPatternsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const patternsQuery = useWorkflowPatterns(enabled, true);
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const [open, setOpen] = useState(false);
  const [editPattern, setEditPattern] = useState<WorkflowPattern | null>(null);
  const [cloneTarget, setCloneTarget] = useState<WorkflowPattern | null>(null);
  const [inactiveTarget, setInactiveTarget] = useState<WorkflowPattern | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const usagePatternId = inactiveTarget?.id ?? (cloneTarget?.active === false ? null : cloneTarget?.id) ?? null;
  const usageQuery = useQuery({
    queryKey: queryKeys.masters.workflowPatternUsage(usagePatternId ?? 0),
    queryFn: () => apiGet<WorkflowPatternUsage>(`/api/workflow-patterns/${usagePatternId}/usage`),
    enabled: usagePatternId != null,
  });
  const usageBlocked = usageQuery.data?.blocked === true;

  const statusFiltered = useMemo(() => {
    const items = patternsQuery.data ?? [];
    if (statusFilter === "all") return items;
    if (statusFilter === "active") return items.filter((row) => row.active !== false);
    return items.filter((row) => row.active === false);
  }, [patternsQuery.data, statusFilter]);

  const getSearchText = useCallback(patternSearchText, []);

  const list = useClientList({
    items: statusFiltered,
    getSearchText,
    filterKey: statusFilter,
  });

  const createPattern = useMutation({
    mutationFn: (payload: CreateWorkflowPatternPayload) =>
      apiPost<WorkflowPattern & { warnings?: string[] }>("/api/workflow-patterns", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Workflow pattern created", `${data.name} (v${data.versionNo})`);
      if (data.warnings?.length) {
        toast.success("Pattern notes", data.warnings.join(" "));
      }
      setOpen(false);
    },
    onError: (error) => toast.errorFromApi(error, "Could not create workflow pattern"),
  });

  const saveEditPattern = useMutation({
    mutationFn: async (payload: {
      id: number;
      name: string;
      previousName: string;
      tasks: CreateWorkflowPatternPayload["tasks"];
    }) => {
      if (payload.name !== payload.previousName) {
        await apiPatch(`/api/workflow-patterns/${payload.id}`, { name: payload.name });
      }
      return apiPatch<WorkflowPattern & { warnings?: string[] }>(
        `/api/workflow-patterns/${payload.id}/tasks`,
        { tasks: payload.tasks },
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Workflow pattern updated", `${data.name} - ${data.tasks.length} steps`);
      if (data.warnings?.length) {
        toast.success("Pattern notes", data.warnings.join(" "));
      }
      setEditPattern(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update workflow pattern"),
  });

  const updatePattern = useMutation({
    mutationFn: (payload: { id: number; active?: boolean }) =>
      apiPatch<WorkflowPattern>(`/api/workflow-patterns/${payload.id}`, {
        active: payload.active,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Workflow pattern updated", data.name);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update workflow pattern"),
  });

  const clonePattern = useMutation({
    mutationFn: (id: number) => apiPost<WorkflowPattern>(`/api/workflow-patterns/${id}/clone`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Pattern cloned", `${data.name} v${data.versionNo} is now active`);
      setCloneTarget(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not clone workflow pattern"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <ListPage
      title="Workflow Patterns"
        actions={
          <AppButton type="button" appVariant="primary" size="sm" onClick={() => setOpen(true)}>
            Add Pattern
          </AppButton>
        }
        search={{
          value: list.search,
          onChange: list.setSearch,
          placeholder: "Search name or product type…",
          "aria-label": "Search workflow patterns",
        }}
        filters={
          <ListSelectFilter
            id="workflow-status-filter"
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={STATUS_OPTIONS}
          />
        }
        onRefresh={() => patternsQuery.refetch()}
        isRefreshing={patternsQuery.isFetching}
        query={{
          isLoading: patternsQuery.isLoading,
          isError: patternsQuery.isError,
          error: patternsQuery.error,
          onRetry: () => patternsQuery.refetch(),
        }}
        pagination={{
          total: list.total,
          page: list.page,
          pageSize: list.pageSize,
          onPageChange: list.setPage,
          onPageSizeChange: list.setPageSize,
          pageSizeSelectId: "workflow-patterns-page-size",
        }}
        overlays={
          <>
            <CreateWorkflowPatternModal
              open={open}
              onClose={() => setOpen(false)}
              onSubmit={(payload) => createPattern.mutate(payload)}
              isPending={createPattern.isPending}
            />

            <CreateWorkflowPatternModal
              open={!!editPattern}
              onClose={() => setEditPattern(null)}
              onSubmit={() => {}}
              isPending={false}
              editPattern={editPattern}
              onSubmitEdit={(patternId, payload) =>
                editPattern &&
                saveEditPattern.mutate({
                  id: patternId,
                  name: payload.name,
                  previousName: editPattern.name,
                  tasks: payload.tasks,
                })
              }
              isEditPending={saveEditPattern.isPending}
            />

            <Modal
              open={!!cloneTarget}
              title="Clone as new version"
              description="Creates a new version and makes the current one inactive."
              onClose={() => setCloneTarget(null)}
              size="sm"
              footer={
                <ModalFooterActions>
                  <AppButton type="button" appVariant="ghost" size="sm" onClick={() => setCloneTarget(null)}>
                    Cancel
                  </AppButton>
                  <AppButton
                    type="button"
                    size="sm"
                    disabled={
                      clonePattern.isPending ||
                      (cloneTarget?.active !== false &&
                        (usageQuery.isLoading || usageQuery.isError || usageBlocked))
                    }
                    onClick={() => cloneTarget && clonePattern.mutate(cloneTarget.id)}
                  >
                    {clonePattern.isPending ? "Cloning…" : "Clone pattern"}
                  </AppButton>
                </ModalFooterActions>
              }
            >
              {cloneTarget ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Clone <strong>{cloneTarget.name}</strong> v{cloneTarget.versionNo} to v
                    {cloneTarget.versionNo + 1}?
                  </p>
                  {usageQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Checking designs that use this pattern…</p>
                  ) : null}
                  {usageQuery.isError ? (
                    <ModalAlert variant="error">
                      Could not check designs using this pattern. Try again.
                    </ModalAlert>
                  ) : null}
                  {usageQuery.data?.blocked ? <OpenDesignList usage={usageQuery.data} /> : null}
                </div>
              ) : null}
            </Modal>

            <Modal
              open={!!inactiveTarget}
              title="Make pattern inactive?"
              description="Inactive patterns are hidden from new designs. Completed designs keep this workflow."
              onClose={() => setInactiveTarget(null)}
              size="sm"
              footer={
                <ModalFooterActions>
                  <AppButton
                    type="button"
                    appVariant="ghost"
                    size="sm"
                    onClick={() => setInactiveTarget(null)}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    type="button"
                    appVariant="danger"
                    size="sm"
                    disabled={updatePattern.isPending || usageQuery.isLoading || usageQuery.isError || usageBlocked}
                    onClick={() =>
                      inactiveTarget &&
                      updatePattern.mutate(
                        { id: inactiveTarget.id, active: false },
                        { onSuccess: () => setInactiveTarget(null) },
                      )
                    }
                  >
                    {updatePattern.isPending ? "Saving…" : "Make inactive"}
                  </AppButton>
                </ModalFooterActions>
              }
            >
              {inactiveTarget ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Make <strong>{inactiveTarget.name}</strong> v{inactiveTarget.versionNo} inactive?
                  </p>
                  {usageQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Checking designs that use this pattern…</p>
                  ) : null}
                  {usageQuery.isError ? (
                    <ModalAlert variant="error">
                      Could not check designs using this pattern. Try again.
                    </ModalAlert>
                  ) : null}
                  {usageQuery.data && !usageQuery.data.blocked ? (
                    <p className="text-sm text-muted-foreground">
                      No open designs are using this workflow. You can make it inactive.
                    </p>
                  ) : null}
                  {usageQuery.data?.blocked ? <OpenDesignList usage={usageQuery.data} /> : null}
                </div>
              ) : null}
            </Modal>
          </>
        }
      >
        <DataTable
          flush
          columns={[
            { key: "name", header: "Pattern Name" },
            {
              key: "productType",
              header: "Product Type",
              render: (row) => row.productType?.name ?? "All types",
            },
            { key: "versionNo", header: "Version", align: "center" },
            {
              key: "tasks",
              header: "Steps",
              render: (row) => row.tasks?.length ?? 0,
            },
            {
              key: "status",
              header: "Status",
              render: (row) =>
                row.active === false ? (
                  <StatusBadge status="CLOSED" label="Inactive" />
                ) : (
                  <StatusBadge status="ACTIVE" label="Active" />
                ),
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row) => (
                <TableIconActionGroup>
                  <TableIconAction action="edit" onClick={() => setEditPattern(row)} />
                  <TableIconAction action="clone" onClick={() => setCloneTarget(row)} />
                  <TableIconAction
                    action={row.active === false ? "activate" : "deactivate"}
                    disabled={updatePattern.isPending}
                    onClick={() => {
                      if (row.active === false) {
                        updatePattern.mutate({ id: row.id, active: true });
                        return;
                      }
                      setInactiveTarget(row);
                    }}
                  />
                </TableIconActionGroup>
              ),
            },
          ]}
          rows={list.pageItems}
          getRowKey={(row) => String(row.id)}
          emptyTitle={
            list.search || statusFilter !== "all"
              ? "No patterns match your filters"
              : "No workflow patterns"
          }
          emptyDescription="Create a pattern to get started."
          emptyAction={
            !list.search && statusFilter === "all" ? (
              <AppButton type="button" appVariant="primary" size="sm" onClick={() => setOpen(true)}>
                Add Pattern
              </AppButton>
            ) : undefined
          }
        />
    </ListPage>
  );
}
