"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { PERMISSIONS } from "@/lib/permissions";
import { apiGet, apiPost, apiPut } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/config/routes";
import { SPEC_KPI_METRICS } from "@/lib/kpi-metrics";
import { FormTextField } from "@/components/ui/form-text-field";

type BenchmarkResponse = {
  year: number;
  month: number;
  employeeCount: number;
  teamAverageWeighted: number | null;
  metrics: Array<{
    metricCode: string;
    label: string;
    average: number | null;
    p50: number | null;
    p90: number | null;
    sampleSize: number;
  }>;
  employees: Array<{
    employeeId: number;
    name: string;
    employeeCode: string;
    roleCode: string;
    weightedTotal: number;
    vsTeamAvg: number | null;
  }>;
};

type Scorecard = {
  id: number;
  code: string;
  name: string;
  metricWeights: Record<string, number>;
};

export function KpiBenchmarkView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [year] = useState(now.getUTCFullYear());
  const [month] = useState(now.getUTCMonth() + 1);
  const [cardName, setCardName] = useState("Design Ops Scorecard");
  const [cardCode, setCardCode] = useState("DESIGN_OPS");

  const defaultWeights = useMemo(() => {
    const w: Record<string, number> = {};
    for (const m of SPEC_KPI_METRICS) w[m.code] = m.weight;
    return w;
  }, []);

  const benchmarkQuery = useQuery({
    queryKey: ["kpi", "benchmark", year, month],
    queryFn: () =>
      apiGet<BenchmarkResponse>(`/api/kpi/benchmark?year=${year}&month=${month}`),
    enabled,
  });

  const scorecardsQuery = useQuery({
    queryKey: ["kpi", "scorecards"],
    queryFn: () => apiGet<Scorecard[]>("/api/kpi/scorecards"),
    enabled,
  });

  const createCard = useMutation({
    mutationFn: () =>
      apiPost("/api/kpi/scorecards", {
        code: cardCode,
        name: cardName,
        metricWeights: defaultWeights,
      }),
    onSuccess: () => {
      toast.success("Scorecard created");
      queryClient.invalidateQueries({ queryKey: ["kpi", "scorecards"] });
    },
    onError: (e) => toast.errorFromApi(e, "Could not create scorecard"),
  });

  const applyCard = useMutation({
    mutationFn: (scorecardId: number) =>
      apiPut("/api/kpi/scorecards", { scorecardId, year, month }),
    onSuccess: () => toast.success("Scorecard ranking computed"),
    onError: (e) => toast.errorFromApi(e, "Could not apply scorecard"),
  });

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  const data = benchmarkQuery.data;

  function handleRefresh() {
    void benchmarkQuery.refetch();
    void scorecardsQuery.refetch();
  }

  return (
    <div className="page-shell page-shell--wide list-page">
      <PageHeader
        title="KPI Benchmarking"
        subtitle="Compare employees to team average / percentiles and manage custom scorecards."
        className="list-page__header"
        actions={
          <>
            <ListRefreshButton
              onRefresh={handleRefresh}
              isRefreshing={benchmarkQuery.isFetching || scorecardsQuery.isFetching}
            />
            <AppButtonLink href={ROUTES.analytics.kpi} appVariant="secondary" size="sm">
              Performance KPI
            </AppButtonLink>
          </>
        }
      />

      <QueryState
        isLoading={benchmarkQuery.isLoading}
        isError={benchmarkQuery.isError}
        error={benchmarkQuery.error}
        onRetry={() => benchmarkQuery.refetch()}
      >
        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">
            Team snapshot ({year}-{String(month).padStart(2, "0")})
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {data?.employeeCount ?? 0} employees · team avg weighted{" "}
            <strong>{data?.teamAverageWeighted ?? "—"}</strong>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2">Metric</th>
                  <th className="text-right p-2">Avg</th>
                  <th className="text-right p-2">P50</th>
                  <th className="text-right p-2">P90</th>
                  <th className="text-right p-2">n</th>
                </tr>
              </thead>
              <tbody>
                {(data?.metrics ?? []).map((m) => (
                  <tr key={m.metricCode} className="border-t">
                    <td className="p-2">{m.label}</td>
                    <td className="p-2 text-right">{m.average ?? "—"}</td>
                    <td className="p-2 text-right">{m.p50 ?? "—"}</td>
                    <td className="p-2 text-right">{m.p90 ?? "—"}</td>
                    <td className="p-2 text-right">{m.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-base font-semibold mb-2">Vs team average</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left p-2">Employee</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-right p-2">Weighted</th>
                  <th className="text-right p-2">Δ vs team</th>
                </tr>
              </thead>
              <tbody>
                {(data?.employees ?? []).map((e) => (
                  <tr key={e.employeeId} className="border-t">
                    <td className="p-2">
                      {e.name}{" "}
                      <span className="text-muted-foreground">({e.employeeCode})</span>
                    </td>
                    <td className="p-2">{e.roleCode}</td>
                    <td className="p-2 text-right">{e.weightedTotal}</td>
                    <td className="p-2 text-right">
                      {e.vsTeamAvg == null
                        ? "—"
                        : e.vsTeamAvg > 0
                          ? `+${e.vsTeamAvg}`
                          : e.vsTeamAvg}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">Custom scorecards</h2>
          <div className="flex flex-wrap gap-3 items-end mb-3">
            <FormTextField
              id="scorecard-name"
              label="Name"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
            />
            <FormTextField
              id="scorecard-code"
              label="Code"
              value={cardCode}
              onChange={(e) => setCardCode(e.target.value)}
            />
            <AppButton
              type="button"
              onClick={() => createCard.mutate()}
              disabled={createCard.isPending}
            >
              Create from spec weights
            </AppButton>
          </div>
          <ul className="space-y-2">
            {(scorecardsQuery.data ?? []).map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between gap-3 border rounded-md p-3"
              >
                <div>
                  <div className="font-medium">{card.name}</div>
                  <div className="text-xs text-muted-foreground">{card.code}</div>
                </div>
                <AppButton
                  type="button"
                  appVariant="secondary"
                  size="sm"
                  onClick={() => applyCard.mutate(card.id)}
                >
                  Rank this period
                </AppButton>
              </li>
            ))}
          </ul>
        </section>
      </QueryState>
    </div>
  );
}
