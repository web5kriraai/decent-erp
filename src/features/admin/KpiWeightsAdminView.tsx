"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable } from "@/components/DataTable";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { FormTextField } from "@/components/ui/form-text-field";
import { apiGet, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { roleKpiWeightsSumOk } from "@/lib/services/kpi-weight-utils";

type KpiDefinition = {
  id: number;
  roleId: number;
  metricCode: string;
  weightPercent: string | number;
  role?: { id: number; code: string; name: string };
};

export function KpiWeightsAdminView() {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const listQuery = useQuery({
    queryKey: queryKeys.masters.kpiDefinitions,
    queryFn: () => apiGet<KpiDefinition[]>("/api/masters/kpi-definitions"),
  });

  const save = useMutation({
    mutationFn: (payload: { id: number; weightPercent: number }) =>
      apiPatch(`/api/masters/kpi-definitions/${payload.id}`, {
        weightPercent: payload.weightPercent,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.kpiDefinitions });
      toast.success("KPI weight updated");
    },
    onError: (e) => toast.errorFromApi(e, "Could not update KPI weight"),
  });

  const rows = listQuery.data ?? [];

  const roleSumById = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of rows) {
      const weight = Number(drafts[row.id] ?? row.weightPercent);
      map.set(row.roleId, (map.get(row.roleId) ?? 0) + (Number.isFinite(weight) ? weight : 0));
    }
    return map;
  }, [rows, drafts]);

  function effectiveWeight(row: KpiDefinition) {
    return Number(drafts[row.id] ?? row.weightPercent);
  }

  function canSaveRow(row: KpiDefinition) {
    const projected = rows
      .filter((r) => r.roleId === row.roleId)
      .map((r) => (r.id === row.id ? effectiveWeight(row) : Number(drafts[r.id] ?? r.weightPercent)));
    return roleKpiWeightsSumOk(projected).ok;
  }

  return (
    <AppCard
      title="KPI Weightage"
      description="Configure role metric weights (each role must total 100%)"
    >
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        onRetry={() => listQuery.refetch()}
        skeletonVariant="table"
      >
        <DataTable
          columns={[
            {
              key: "role",
              header: "Role",
              render: (row) => row.role?.name ?? row.roleId,
            },
            { key: "metricCode", header: "Metric" },
            {
              key: "roleTotal",
              header: "Role total",
              render: (row) => {
                const sum = roleSumById.get(row.roleId) ?? 0;
                const ok = Math.abs(sum - 100) <= 0.01;
                return (
                  <span className={ok ? "text-muted-foreground" : "text-destructive"}>
                    {sum.toFixed(2)}%
                  </span>
                );
              },
            },
            {
              key: "weight",
              header: "Weight %",
              render: (row) => {
                const ok = canSaveRow(row);
                return (
                  <div className="flex items-center gap-2">
                    <FormTextField
                      id={`kpi-w-${row.id}`}
                      label=""
                      value={drafts[row.id] ?? String(row.weightPercent)}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      error={ok ? undefined : "Role weights must total 100%"}
                    />
                    <AppButton
                      size="sm"
                      type="button"
                      disabled={!ok || save.isPending}
                      onClick={() =>
                        save.mutate({
                          id: row.id,
                          weightPercent: effectiveWeight(row),
                        })
                      }
                    >
                      Save
                    </AppButton>
                  </div>
                );
              },
            },
          ]}
          rows={rows}
          getRowKey={(row) => String(row.id)}
          emptyTitle="No KPI definitions"
        />
      </QueryState>
    </AppCard>
  );
}
