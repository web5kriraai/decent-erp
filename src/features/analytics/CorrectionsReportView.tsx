"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { ListPage } from "@/components/ui/ListPage";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { PERMISSIONS } from "@/lib/permissions";
import {
  useCorrectionAnalysisReport,
  type CorrectionAnalysisReport,
} from "@/hooks/use-reports";
import { useClientList } from "@/hooks/use-client-list";

type CorrectionRow = CorrectionAnalysisReport["corrections"][number];

function correctionSearchText(row: CorrectionRow) {
  return `${row.design?.ideaRef ?? ""} ${row.design?.collectionName ?? ""} ${row.correctionType} ${row.task?.subProcess?.name ?? ""} ${row.responsibleEmployee?.name ?? ""} ${row.status}`;
}

export function CorrectionsReportView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const reportQuery = useCorrectionAnalysisReport(enabled);

  const getSearchText = useCallback(correctionSearchText, []);
  const list = useClientList({
    items: reportQuery.data?.corrections ?? [],
    getSearchText,
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const summary = reportQuery.data?.summary;

  return (
    <ListPage
      title="Correction Analysis"
      wide
      search={{
        value: list.search,
        onChange: list.setSearch,
        placeholder: "Search corrections…",
        "aria-label": "Search corrections",
      }}
      onRefresh={() => reportQuery.refetch()}
      isRefreshing={reportQuery.isFetching}
      beforeTable={
        summary ? (
          <>
            <div className="stat-grid">
              <StatCard label="Total corrections" value={list.filtered.length} />
              <StatCard label="Extra minutes" value={summary.totalExtraMinutes} />
              <StatCard
                label="Extra cost"
                value={`₹${summary.totalExtraCost.toLocaleString()}`}
              />
              <StatCard
                label="Mistake types"
                value={Object.keys(summary.byType).length}
              />
            </div>
            <p className="m-0 text-sm font-medium">By correction type</p>
            <ul className="detail-task-list">
              {Object.entries(summary.byType).map(([type, count]) => (
                <li key={type}>
                  <span>{type.replace(/_/g, " ")}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : null
      }
      query={{
        isLoading: reportQuery.isLoading,
        isError: reportQuery.isError,
        error: reportQuery.error,
        onRetry: () => reportQuery.refetch(),
        skeletonVariant: "table",
      }}
      pagination={{
        total: list.total,
        page: list.page,
        pageSize: list.pageSize,
        onPageChange: list.setPage,
        onPageSizeChange: list.setPageSize,
        pageSizeSelectId: "corrections-page-size",
      }}
    >
      <DataTable
        flush
        columns={[
          {
            key: "design",
            header: "Design",
            render: (row) =>
              row.design
                ? `${row.design.ideaRef} - ${row.design.collectionName}`
                : "-",
          },
          { key: "correctionType", header: "Type" },
          {
            key: "stage",
            header: "Stage",
            render: (row) => row.task?.subProcess?.name ?? "-",
          },
          {
            key: "responsible",
            header: "Responsible",
            render: (row) => row.responsibleEmployee?.name ?? "-",
          },
          {
            key: "status",
            header: "Status",
            render: (row) => <StatusBadge status={row.status} />,
          },
          {
            key: "extraMinutes",
            header: "Extra min",
            align: "right",
            render: (row) => row.extraMinutes ?? 0,
          },
        ]}
        rows={list.pageItems}
        getRowKey={(row) => String(row.id)}
        emptyTitle="No corrections recorded"
      />
    </ListPage>
  );
}
