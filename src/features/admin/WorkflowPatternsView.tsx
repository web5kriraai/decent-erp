"use client";

import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useWorkflowPatterns } from "@/hooks/use-masters";

export function WorkflowPatternsView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const patternsQuery = useWorkflowPatterns(enabled);

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
          emptyDescription="Run database seed or configure patterns in administration."
        />
      </QueryState>
    </div>
  );
}
