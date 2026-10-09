"use client";

import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { apiGet } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type HistoryRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  atUtc: string;
  correlationId?: string | null;
  user: { id: number; name: string; employeeCode: string };
};

type HistoryResponse = {
  items: HistoryRow[];
  total: number;
};

export function ActivityTimelinePanel({ designId }: { designId: string }) {
  const historyQuery = useQuery({
    queryKey: queryKeys.designs.history(designId),
    queryFn: () => apiGet<HistoryResponse>(`/api/designs/${designId}/history?limit=100`),
  });

  return (
    <QueryState
      isLoading={historyQuery.isLoading}
      isError={historyQuery.isError}
      error={historyQuery.error}
      onRetry={() => historyQuery.refetch()}
      skeletonVariant="table"
    >
      <DataTable<HistoryRow & Record<string, unknown>>
        flush
        columns={[
          {
            key: "atUtc",
            header: "When",
            render: (row) =>
              new Date(row.atUtc).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
          },
          { key: "action", header: "Action" },
          { key: "entityType", header: "Entity" },
          {
            key: "user",
            header: "User",
            render: (row) => row.user.name,
          },
        ]}
        rows={(historyQuery.data?.items ?? []) as (HistoryRow & Record<string, unknown>)[]}
        getRowKey={(row) => row.id}
        emptyTitle="No activity yet"
        emptyDescription="Changes to this design will appear here."
      />
    </QueryState>
  );
}
