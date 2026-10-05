"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ListPage } from "@/components/ui/ListPage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { apiGet } from "@/lib/api-client";
import { ROUTES } from "@/config/routes";
import { useClientList } from "@/hooks/use-client-list";
import {
  formatMachineOutputSummary,
  pickPreferredSampleOutput,
} from "@/lib/services/task-machine-output-utils";

type WorkbenchTask = {
  id: string;
  status: string;
  designId: string;
  design?: { ideaRef?: string; collectionName?: string };
  subProcess?: { code?: string; name?: string };
  assignedEmployee?: { name?: string } | null;
  artifacts?: Array<{
    artifactType: string;
    stitchCount?: number | null;
    machineFormat?: string | null;
    sampleQty?: number | null;
    wastageQty?: number | null;
    storageKey?: string | null;
    fileName?: string | null;
  }>;
  sampleMachine?: { name?: string; code?: string } | null;
};

function workbenchSearchText(row: WorkbenchTask) {
  return [
    row.design?.ideaRef,
    row.design?.collectionName,
    row.subProcess?.name,
    row.subProcess?.code,
    row.assignedEmployee?.name,
    row.sampleMachine?.name,
    row.status,
  ]
    .filter(Boolean)
    .join(" ");
}

export function OpsWorkbenchView({
  title,
  subtitle,
  stageCodes,
}: {
  title: string;
  subtitle: string;
  stageCodes: string[];
}) {
  const listQuery = useQuery({
    queryKey: ["workbench", stageCodes.join(",")],
    queryFn: () =>
      apiGet<WorkbenchTask[]>(
        `/api/tasks/workbench?stages=${encodeURIComponent(stageCodes.join(","))}`,
      ),
  });

  const getSearchText = useCallback(workbenchSearchText, []);

  const list = useClientList({
    items: listQuery.data ?? [],
    getSearchText,
    filterKey: stageCodes.join(","),
  });

  return (
    <ListPage
      title={title}
      subtitle={subtitle}
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search design, stage, owner…",
        "aria-label": "Search workbench queue",
      }}
      onRefresh={() => listQuery.refetch()}
      isRefreshing={listQuery.isFetching}
      query={{
        isLoading: listQuery.isLoading,
        isError: listQuery.isError,
        error: listQuery.error,
        onRetry: () => listQuery.refetch(),
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: `workbench-${stageCodes.join("-")}-page-size`,
      }}
    >
      <DataTable
        flush
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) => (
              <Link href={ROUTES.work.taskDetail(row.id)}>
                {row.design?.ideaRef ?? row.designId}
              </Link>
            ),
          },
          {
            key: "stage",
            header: "Stage",
            render: (row) => row.subProcess?.name ?? row.subProcess?.code ?? "—",
          },
          {
            key: "owner",
            header: "Owner",
            render: (row) => row.assignedEmployee?.name ?? "Unassigned",
          },
          {
            key: "machine",
            header: "Machine",
            render: (row) => row.sampleMachine?.name ?? "—",
          },
          {
            key: "meta",
            header: "Output",
            render: (row) => {
              const preferred = pickPreferredSampleOutput(row.artifacts ?? []);
              return formatMachineOutputSummary(preferred) ?? "—";
            },
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
        ]}
        rows={list.pageItems}
        getRowKey={(row) => String(row.id)}
        emptyTitle="No jobs in this workbench"
      />
    </ListPage>
  );
}
