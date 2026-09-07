"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable } from "@/components/DataTable";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { FormTextField } from "@/components/ui/form-text-field";
import { apiGet, apiPatch } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";

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

  return (
    <AppCard title="KPI Weightage" description="Configure role metric weights">
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
              key: "weight",
              header: "Weight %",
              render: (row) => (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <FormTextField
                    id={`kpi-w-${row.id}`}
                    label=""
                    value={drafts[row.id] ?? String(row.weightPercent)}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                  />
                  <AppButton
                    size="sm"
                    type="button"
                    onClick={() =>
                      save.mutate({
                        id: row.id,
                        weightPercent: Number(drafts[row.id] ?? row.weightPercent),
                      })
                    }
                  >
                    Save
                  </AppButton>
                </div>
              ),
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
