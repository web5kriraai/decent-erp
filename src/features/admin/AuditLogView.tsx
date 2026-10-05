"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { ListPage } from "@/components/ui/ListPage";
import { ListDateRangeFilter } from "@/components/ui/ListDateRangeFilter";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppButton } from "@/components/ui/AppButton";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useClientList } from "@/hooks/use-client-list";

type AuditRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  atUtc: string;
  correlationId?: string | null;
  user: { id: number; name: string; employeeCode: string };
};

const ENTITY_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "DesignConcept", label: "Design" },
  { value: "DesignTask", label: "Task" },
  { value: "DesignCorrection", label: "Correction" },
  { value: "DesignApproval", label: "Approval" },
  { value: "DesignCost", label: "Cost" },
  { value: "Employee", label: "Employee" },
];

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function auditSearchText(row: AuditRow) {
  return `${row.entityType} ${row.entityId} ${row.action} ${row.user.name} ${row.user.employeeCode}`;
}

export function AuditLogView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const toast = useApiToast();
  const queryClient = useQueryClient();

  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState(toDateInput(monthAgo));
  const [to, setTo] = useState(toDateInput(today));

  const auditQuery = useQuery({
    queryKey: queryKeys.audit.list({ entityType, from, to }),
    queryFn: () => {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (from) params.set("from", `${from}T00:00:00.000Z`);
      if (to) params.set("to", `${to}T23:59:59.999Z`);
      return apiGet<AuditRow[]>(`/api/admin/audit?${params.toString()}`);
    },
    enabled: canView,
  });

  const getSearchText = useCallback(auditSearchText, []);

  const list = useClientList({
    items: auditQuery.data ?? [],
    getSearchText,
    filterKey: `${entityType}|${from}|${to}`,
  });

  const archive = useMutation({
    mutationFn: () =>
      apiPost<{ archived: number; cutoffIso: string }>("/api/admin/audit/archive", {}),
    onSuccess: (data) => {
      toast.success(
        "Audit archive complete",
        `${data.archived} row(s) moved before ${data.cutoffIso.slice(0, 10)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e) => toast.errorFromApi(e, "Archive failed"),
  });

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <ListPage
      title="Audit Log"
      wide
      actions={
        <AppButton
          type="button"
          appVariant="secondary"
          size="sm"
          disabled={archive.isPending}
          onClick={() => archive.mutate()}
        >
          Archive old logs
        </AppButton>
      }
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search entity, action, or user…",
        "aria-label": "Search audit log",
      }}
      filters={
        <>
          <ListSelectFilter
            id="audit-entity-filter"
            label="Entity"
            value={entityType}
            onChange={setEntityType}
            options={ENTITY_OPTIONS}
          />
          <ListDateRangeFilter
            fromId="audit-from"
            toId="audit-to"
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
          />
        </>
      }
      onRefresh={() => auditQuery.refetch()}
      isRefreshing={auditQuery.isFetching}
      query={{
        isLoading: auditQuery.isLoading,
        isError: auditQuery.isError,
        error: auditQuery.error,
        onRetry: () => auditQuery.refetch(),
        skeletonVariant: "table",
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "audit-page-size",
      }}
    >
      <DataTable
        flush
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
        ]}
        rows={list.pageItems}
        getRowKey={(r) => r.id}
        emptyTitle={
          list.search || entityType || from || to
            ? "No audit records match your filters"
            : "No audit records"
        }
        emptyDescription="System actions will appear here as they occur."
      />
    </ListPage>
  );
}
