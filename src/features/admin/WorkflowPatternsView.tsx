"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useWorkflowPatterns } from "@/hooks/use-masters";
import { apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { Modal, ModalFooterActions } from "@/components/ui/Modal";
import { AppButton } from "@/components/ui/AppButton";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { CreateWorkflowPatternModal } from "@/features/admin/CreateWorkflowPatternModal";
import type { CreateWorkflowPatternPayload, WorkflowPattern } from "@/lib/types/api";

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
      toast.success("Workflow pattern updated", `${data.name} — ${data.tasks.length} steps`);
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
    <div className="page-shell">
      <PageHeader
        title="Workflow Patterns"
        subtitle="Create and maintain versioned task sequences used when generating design work"
        actions={
          <AppButton type="button" appVariant="primary" size="sm" onClick={() => setOpen(true)}>
            Add Pattern
          </AppButton>
        }
      />

      <QueryState
        isLoading={patternsQuery.isLoading}
        isError={patternsQuery.isError}
        error={patternsQuery.error}
        onRetry={() => patternsQuery.refetch()}
      >
        <DataTable
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
                    onClick={() =>
                      updatePattern.mutate({
                        id: row.id,
                        active: row.active === false,
                      })
                    }
                  />
                </TableIconActionGroup>
              ),
            },
          ]}
          rows={patternsQuery.data ?? []}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No workflow patterns"
          emptyDescription="Create a pattern or run database seed for a starter template."
        />
      </QueryState>

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
        description="Creates a new active version with the same steps. The current version will be deactivated. Designs already in progress keep their existing tasks."
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
              disabled={clonePattern.isPending}
              onClick={() => cloneTarget && clonePattern.mutate(cloneTarget.id)}
            >
              {clonePattern.isPending ? "Cloning…" : "Clone pattern"}
            </AppButton>
          </ModalFooterActions>
        }
      >
        {cloneTarget ? (
          <p className="text-sm text-muted-foreground">
            Clone <strong>{cloneTarget.name}</strong> v{cloneTarget.versionNo} to v
            {cloneTarget.versionNo + 1}?
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
