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
import { Modal, ModalFooterActions, ModalForm } from "@/components/ui/Modal";
import { FormTextField } from "@/components/ui/form-text-field";
import { Button } from "@/components/ui/button";
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
  const [editing, setEditing] = useState<WorkflowPattern | null>(null);
  const [editSteps, setEditSteps] = useState<WorkflowPattern | null>(null);
  const [editName, setEditName] = useState("");

  const createPattern = useMutation({
    mutationFn: (payload: CreateWorkflowPatternPayload) =>
      apiPost<WorkflowPattern>("/api/workflow-patterns", payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Workflow pattern created", `${data.name} (v${data.versionNo})`);
      setOpen(false);
    },
    onError: (error) => toast.errorFromApi(error, "Could not create workflow pattern"),
  });

  const updatePatternTasks = useMutation({
    mutationFn: (payload: {
      id: number;
      tasks: CreateWorkflowPatternPayload["tasks"];
    }) =>
      apiPatch<WorkflowPattern>(`/api/workflow-patterns/${payload.id}/tasks`, {
        tasks: payload.tasks,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Pattern steps updated", `${data.name} — ${data.tasks.length} steps`);
      setEditSteps(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update pattern steps"),
  });

  const updatePattern = useMutation({
    mutationFn: (payload: { id: number; name?: string; active?: boolean }) =>
      apiPatch<WorkflowPattern>(`/api/workflow-patterns/${payload.id}`, {
        name: payload.name,
        active: payload.active,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.workflowPatterns });
      toast.success("Workflow pattern updated", data.name);
      setEditing(null);
    },
    onError: (error) => toast.errorFromApi(error, "Could not update workflow pattern"),
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
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
            Add Pattern
          </button>
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
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEditing(row);
                      setEditName(row.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setEditSteps(row)}
                  >
                    Edit steps
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={updatePattern.isPending}
                    onClick={() =>
                      updatePattern.mutate({
                        id: row.id,
                        active: row.active === false,
                      })
                    }
                  >
                    {row.active === false ? "Activate" : "Deactivate"}
                  </button>
                </div>
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
        open={!!editSteps}
        onClose={() => setEditSteps(null)}
        onSubmit={() => {}}
        isPending={false}
        editPattern={editSteps}
        onSubmitTasks={(patternId, tasks) =>
          updatePatternTasks.mutate({ id: patternId, tasks })
        }
        isTasksPending={updatePatternTasks.isPending}
      />

      <Modal
        open={!!editing}
        title="Rename pattern"
        onClose={() => setEditing(null)}
        size="sm"
        footer={
          <ModalFooterActions>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!editName.trim() || updatePattern.isPending}
              onClick={() => editing && updatePattern.mutate({ id: editing.id, name: editName.trim() })}
            >
              Save
            </Button>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField
            id="pattern-rename"
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </ModalForm>
      </Modal>
    </div>
  );
}
