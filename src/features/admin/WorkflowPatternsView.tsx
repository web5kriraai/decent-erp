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
import { apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { CreateWorkflowPatternModal } from "@/features/admin/CreateWorkflowPatternModal";
import type { CreateWorkflowPatternPayload, WorkflowPattern } from "@/lib/types/api";

export function WorkflowPatternsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const patternsQuery = useWorkflowPatterns(enabled);
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const [open, setOpen] = useState(false);

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
        subtitle="Versioned task sequences used when generating design work"
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
              render: () => <StatusBadge status="ACTIVE" label="Active" />,
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
    </div>
  );
}
