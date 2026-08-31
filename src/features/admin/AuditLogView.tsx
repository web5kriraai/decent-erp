"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  atUtc: string;
  correlationId?: string | null;
  user: { id: number; name: string; employeeCode: string };
};

export function AuditLogView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.MASTER_ADMIN);

  const [entityType, setEntityType] = useState("");

  const auditQuery = useQuery({
    queryKey: queryKeys.audit.list({ entityType }),
    queryFn: () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      return apiGet<AuditRow[]>(`/api/admin/audit?${params.toString()}`);
    },
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Audit Log"
        subtitle="Compliance trail of all system changes"
      />

      <div className="form-group" style={{ maxWidth: 320, marginBottom: "1rem" }}>
        <label className="form-label" htmlFor="auditFilter">
          Filter by entity type
        </label>
        <select
          id="auditFilter"
          className="form-select"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        >
          <option value="">All</option>
          <option value="DesignConcept">Design</option>
          <option value="DesignTask">Task</option>
          <option value="DesignCorrection">Correction</option>
          <option value="DesignApproval">Approval</option>
          <option value="DesignCost">Cost</option>
          <option value="Employee">Employee</option>
        </select>
      </div>

      <QueryState
        isLoading={auditQuery.isLoading}
        isError={auditQuery.isError}
        error={auditQuery.error}
        onRetry={() => auditQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="card">
          <DataTable
            columns={[
              {
                key: "atUtc",
                header: "Time",
                render: (r) => new Date(r.atUtc).toLocaleString(),
              },
              { key: "entityType", header: "Entity" },
              { key: "entityId", header: "Entity ID" },
              { key: "action", header: "Action" },
              { key: "user", header: "User", render: (r) => r.user.name },
              {
                key: "correlationId",
                header: "Correlation",
                render: (r) => r.correlationId ?? "-",
              },
            ]}
            rows={auditQuery.data ?? []}
            getRowKey={(r) => r.id}
            emptyTitle="No audit records"
            emptyDescription="System actions will appear here as they occur."
          />
        </div>
      </QueryState>
    </div>
  );
}
