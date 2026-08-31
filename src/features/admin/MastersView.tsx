"use client";

import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import { useProcessMasters } from "@/hooks/use-masters";

export function MastersView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const processesQuery = useProcessMasters(enabled);

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
        title="Process Masters"
        subtitle="Main processes, sub-processes, and workflow configuration"
      />

      <QueryState
        isLoading={processesQuery.isLoading}
        isError={processesQuery.isError}
        error={processesQuery.error}
        onRetry={() => processesQuery.refetch()}
      >
        <DataTable
          columns={[
            { key: "sequence", header: "#", align: "center" },
            { key: "code", header: "Code" },
            { key: "name", header: "Process Name" },
            {
              key: "subProcesses",
              header: "Sub-processes",
              render: (row) => row.subProcesses?.length ?? 0,
            },
            {
              key: "status",
              header: "Status",
              render: () => <StatusBadge status="ACTIVE" label="Active" />,
            },
          ]}
          rows={processesQuery.data ?? []}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No process masters configured"
          emptyDescription="Seed workflow patterns and process masters to enable task generation."
        />
      </QueryState>
    </div>
  );
}
