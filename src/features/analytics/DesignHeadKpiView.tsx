"use client";



import { useCallback } from "react";

import { useSession } from "next-auth/react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageHeader } from "@/components/ui/PageHeader";

import { QueryState } from "@/components/ui/QueryState";

import { StatCard } from "@/components/ui/StatCard";

import { AppCard } from "@/components/ui/AppCard";

import { AppButton, AppButtonLink } from "@/components/ui/AppButton";

import { PermissionDenied } from "@/components/PermissionDenied";

import { DataTable } from "@/components/DataTable";

import { ListSearch } from "@/components/ui/ListSearch";

import { PaginationBar } from "@/components/ui/PaginationBar";

import { ListRefreshButton } from "@/components/ui/ListRefreshButton";

import { PERMISSIONS } from "@/lib/permissions";

import { apiGet, apiPost } from "@/lib/api-client";

import { queryKeys } from "@/lib/query-keys";

import { useApiToast } from "@/components/ui/ToastProvider";

import { ROUTES } from "@/config/routes";

import { useConceptTargets } from "@/hooks/use-masters";

import { useClientList } from "@/hooks/use-client-list";



type TeamScoreRow = {

  id: string;

  metricCode: string;

  score: string;

  weightedScore: string;

  periodYear: number;

  periodMonth: number;

  employee: { name: string; employeeCode: string };

};



type BreakdownRow = {

  key: string;

  label: string;

  count: number;

  liveCount: number;

  salesQty: number;

};



type DesignHeadKpiResponse = {

  periodYear: number;

  periodMonth: number;

  ideasCreated: number;

  approvedCount: number;

  releasedCount: number;

  liveCount: number;

  rejectedCount: number;

  conversionPercent: number;

  liveConversionPercent: number;

  salesConversionPercent: number;

  avgLeadTimeDays: number | null;

  teamFtrPercent: number | null;

  teamCorrectionRatePercent: number | null;

  costVsBudget: {

    estimatedBudget: number;

    actualCost: number;

    variancePercent: number | null;

  };

  successBy: {

    season: BreakdownRow[];

    collection: BreakdownRow[];

    product: BreakdownRow[];

  };

  teamScores: TeamScoreRow[];

};



function breakdownSearchText(row: BreakdownRow) {

  return row.label;

}



function teamScoreSearchText(row: TeamScoreRow) {

  return `${row.employee.name} ${row.employee.employeeCode} ${row.metricCode} ${row.periodYear} ${row.periodMonth}`;

}



function BreakdownTable({

  title,

  rows,

  pageSizeSelectId,

}: {

  title: string;

  rows: BreakdownRow[];

  pageSizeSelectId: string;

}) {

  const getSearchText = useCallback(breakdownSearchText, []);

  const list = useClientList({ items: rows, getSearchText });



  return (

    <AppCard title={title} flush>

      <div className="page-toolbar !mb-0 border-b px-3 py-2">

        <ListSearch

          value={list.search}

          onChange={list.setSearch}

          placeholder="Search…"

          aria-label={`Search ${title}`}

        />

      </div>

      <DataTable

        flush

        columns={[

          { key: "label", header: "Name", render: (r) => r.label },

          {

            key: "count",

            header: "Ideas",

            align: "right",

            render: (r) => r.count,

          },

          {

            key: "liveCount",

            header: "Live/Rel",

            align: "right",

            render: (r) => r.liveCount,

          },

          {

            key: "salesQty",

            header: "Sales qty",

            align: "right",

            render: (r) => r.salesQty,

          },

        ]}

        rows={list.pageItems}

        getRowKey={(r) => r.key}

        emptyTitle="No data"

        emptyDescription="No designs in this period."

      />

      {list.total > 0 ? (

        <PaginationBar

          total={list.total}

          page={list.page}

          pageSize={list.pageSize}

          onPageChange={list.setPage}

          onPageSizeChange={list.setPageSize}

          pageSizeSelectId={pageSizeSelectId}

        />

      ) : null}

    </AppCard>

  );

}



export function DesignHeadKpiView() {

  const { data: session } = useSession();

  const permissions = session?.user?.permissions ?? [];

  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);



  const kpiQuery = useQuery({

    queryKey: queryKeys.kpi.designHead,

    queryFn: () => apiGet<DesignHeadKpiResponse>("/api/kpi/design-head"),

    enabled,

  });

  const conceptTargetsQuery = useConceptTargets(enabled);

  const conceptAttainment = conceptTargetsQuery.data?.attainment;

  const queryClient = useQueryClient();

  const toast = useApiToast();

  const recompute = useMutation({

    mutationFn: () => apiPost<{ count: number }>("/api/kpi/recompute", {}),

    onSuccess: (data) => {

      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.employeesRoot });

      queryClient.invalidateQueries({ queryKey: queryKeys.kpi.designHead });

      queryClient.invalidateQueries({ queryKey: ["masters", "concept-targets"] });

      toast.success("KPI recomputed", `${data.count} score records updated`);

    },

    onError: (error) => toast.errorFromApi(error, "Recompute failed"),

  });



  const teamScores = kpiQuery.data?.teamScores ?? [];

  const getTeamScoreSearchText = useCallback(teamScoreSearchText, []);

  const scoreList = useClientList({

    items: teamScores,

    getSearchText: getTeamScoreSearchText,

  });



  function handleRefresh() {

    void kpiQuery.refetch();

    void conceptTargetsQuery.refetch();

  }



  if (!enabled) {

    return (

      <div className="page-shell">

        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />

      </div>

    );

  }



  const data = kpiQuery.data;

  const periodLabel = data

    ? `${data.periodMonth}/${data.periodYear}`

    : new Date().toLocaleString("en", { month: "short", year: "numeric" });



  return (

    <div className="page-shell list-page">

      <PageHeader

        title="Design Head KPI"

        className="list-page__header"

        actions={

          <>

            <ListRefreshButton

              onRefresh={handleRefresh}

              isRefreshing={kpiQuery.isFetching || conceptTargetsQuery.isFetching}

            />

            <AppButtonLink href={ROUTES.analytics.reportsHub} appVariant="secondary" size="sm">

              Reports

            </AppButtonLink>

            <AppButtonLink href={ROUTES.analytics.kpi} appVariant="secondary" size="sm">

              Employees

            </AppButtonLink>

            <AppButtonLink href={ROUTES.analytics.kpiDesignHead} appVariant="secondary" size="sm">

              Design Head

            </AppButtonLink>

            <AppButton

              type="button"

              appVariant="primary"

              size="sm"

              disabled={recompute.isPending}

              onClick={() => recompute.mutate()}

            >

              Recompute

            </AppButton>

          </>

        }

      />

      <QueryState

        isLoading={kpiQuery.isLoading}

        isError={kpiQuery.isError}

        error={kpiQuery.error}

        onRetry={() => kpiQuery.refetch()}

        skeletonVariant="stats"

      >

        {data ? (

          <>

            <div className="stat-grid stack-section">

              <StatCard label="Ideas" value={data.ideasCreated} />

              <StatCard label="Approved" value={data.approvedCount} />

              <StatCard label="Released" value={data.releasedCount} />

              <StatCard label="Live" value={data.liveCount} />

              <StatCard label="Rejected" value={data.rejectedCount} />

              <StatCard

                label="Release conversion"

                value={`${data.conversionPercent}%`}

                tone="accent"

                trend={periodLabel}

              />

              <StatCard

                label="Live conversion"

                value={`${data.liveConversionPercent}%`}

                trend={periodLabel}

              />

              <StatCard

                label="Sales conversion"

                value={`${data.salesConversionPercent}%`}

                trend={periodLabel}

              />

              <StatCard

                label="Avg lead time"

                value={

                  data.avgLeadTimeDays != null ? `${data.avgLeadTimeDays}d` : "—"

                }

              />

              <StatCard

                label="Team FTR"

                value={

                  data.teamFtrPercent != null ? `${data.teamFtrPercent}%` : "—"

                }

              />

              <StatCard

                label="Mistake correction rate"

                value={

                  data.teamCorrectionRatePercent != null

                    ? `${data.teamCorrectionRatePercent}%`

                    : "—"

                }

              />

              <StatCard

                label="Cost vs budget"

                value={

                  data.costVsBudget.variancePercent != null

                    ? `${data.costVsBudget.variancePercent}%`

                    : "—"

                }

                trend={`Actual ${data.costVsBudget.actualCost} / Budget ${data.costVsBudget.estimatedBudget}`}

              />

              {conceptAttainment ? (

                <StatCard

                  label="Concept target"

                  value={`${conceptAttainment.createdCount}/${conceptAttainment.targetCount || "-"}`}

                  trend={`${conceptAttainment.percent}% · ${periodLabel}`}

                />

              ) : null}

            </div>



            <div className="grid gap-4 stack-section lg:grid-cols-3">

              <BreakdownTable

                title="By season"

                rows={data.successBy.season}

                pageSizeSelectId="design-head-season-page-size"

              />

              <BreakdownTable

                title="By collection"

                rows={data.successBy.collection}

                pageSizeSelectId="design-head-collection-page-size"

              />

              <BreakdownTable

                title="By product"

                rows={data.successBy.product}

                pageSizeSelectId="design-head-product-page-size"

              />

            </div>



            <AppCard title="Score detail" className="stack-section" flush>

              <div className="page-toolbar !mb-0 border-b px-3 py-2">

                <ListSearch

                  value={scoreList.search}

                  onChange={scoreList.setSearch}

                  placeholder="Search scores…"

                  aria-label="Search score detail"

                />

              </div>

              <DataTable

                flush

                columns={[

                  {

                    key: "employee",

                    header: "Design Head",

                    render: (r) => r.employee.name,

                  },

                  { key: "metricCode", header: "Metric" },

                  {

                    key: "period",

                    header: "Period",

                    render: (r) => `${r.periodMonth}/${r.periodYear}`,

                  },

                  { key: "score", header: "Score", align: "right" },

                  { key: "weightedScore", header: "Weighted", align: "right" },

                ]}

                rows={scoreList.pageItems}

                getRowKey={(r) => r.id}

                emptyTitle="No scores"

                emptyDescription="Run Recompute."

              />

              {scoreList.total > 0 ? (

                <PaginationBar

                  total={scoreList.total}

                  page={scoreList.page}

                  pageSize={scoreList.pageSize}

                  onPageChange={scoreList.setPage}

                  onPageSizeChange={scoreList.setPageSize}

                  pageSizeSelectId="design-head-scores-page-size"

                />

              ) : null}

            </AppCard>

          </>

        ) : null}

      </QueryState>

    </div>

  );

}

