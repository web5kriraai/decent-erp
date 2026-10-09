"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { ListSearch } from "@/components/ui/ListSearch";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { apiPost } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useClientList } from "@/hooks/use-client-list";
import {
  useConceptTargets,
  useProductTypes,
  useSeasons,
} from "@/hooks/use-masters";
import type { ConceptTargetsResponse } from "@/hooks/use-masters";

type ConceptTargetRow = ConceptTargetsResponse["targets"][number];

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function conceptTargetSearchText(row: ConceptTargetRow) {
  return `${row.season?.name ?? ""} ${row.productType?.name ?? ""} ${row.note ?? ""} ${row.targetCount}`;
}

export function ConceptTargetsAdminView() {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [targetCount, setTargetCount] = useState("10");
  const [seasonId, setSeasonId] = useState("ALL");
  const [productTypeId, setProductTypeId] = useState("ALL");
  const [note, setNote] = useState("");

  const targetsQuery = useConceptTargets(true, year, month);
  const seasons = useSeasons(true);
  const productTypes = useProductTypes(true);

  const rows = targetsQuery.data?.targets ?? [];
  const attainment = targetsQuery.data?.attainment;

  const getSearchText = useCallback(conceptTargetSearchText, []);

  const list = useClientList({
    items: rows,
    getSearchText,
    filterKey: `${year}-${month}`,
  });

  const seasonOptions = useMemo(
    () => [
      { value: "ALL", label: "All seasons" },
      ...(seasons.data ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    ],
    [seasons.data],
  );

  const productOptions = useMemo(
    () => [
      { value: "ALL", label: "All categories" },
      ...(productTypes.data ?? []).map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    ],
    [productTypes.data],
  );

  const periodLabel = `${MONTH_OPTIONS[month - 1]?.label ?? month} ${year}`;

  const save = useMutation({
    mutationFn: () =>
      apiPost("/api/masters/concept-targets", {
        periodYear: year,
        periodMonth: month,
        targetCount: Number(targetCount) || 0,
        seasonId: seasonId && seasonId !== "ALL" ? Number(seasonId) : null,
        productTypeId:
          productTypeId && productTypeId !== "ALL" ? Number(productTypeId) : null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters", "concept-targets"] });
      toast.success("Concept target saved");
      setNote("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not save concept target"),
  });

  return (
    <div className="vstack vstack--tight">
      <AppCard
        title="Set concept target"
        description="Monthly quota of new design concepts. Optional season and category split the quota. Design Head KPI compares concepts created in the month against this number."
      >
        <div className="form-grid">
          <div className="form-grid form-grid--2">
            <FormTextField
              id="ct-year"
              label="Year"
              type="number"
              min={2000}
              max={2100}
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
            <FormSelect
              id="ct-month"
              label="Month"
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v) || month)}
              options={MONTH_OPTIONS}
            />
          </div>
          <div className="form-grid form-grid--2">
            <FormSelect
              id="ct-season"
              label="Season"
              value={seasonId}
              onValueChange={(v) => setSeasonId(v || "ALL")}
              options={seasonOptions}
              hint="Leave as all seasons for a company-wide quota."
            />
            <FormSelect
              id="ct-product"
              label="Product category"
              value={productTypeId}
              onValueChange={(v) => setProductTypeId(v || "ALL")}
              options={productOptions}
              hint="Leave as all categories, or set a quota for one product."
            />
          </div>
          <div className="form-grid form-grid--2">
            <FormTextField
              id="ct-count"
              label="Target count"
              required
              type="number"
              min={0}
              value={targetCount}
              onChange={(e) => setTargetCount(e.target.value)}
              hint="How many new concepts should be created this month."
            />
            <FormTextField
              id="ct-note"
              label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-xs text-muted-foreground">
              {attainment && attainment.targetCount > 0
                ? `${periodLabel}: ${attainment.createdCount} created of ${attainment.targetCount} targeted (${attainment.percent}%).`
                : `${periodLabel}: no target saved yet.`}
            </p>
            <AppButton
              type="button"
              disabled={save.isPending || Number(targetCount) < 0}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save target"}
            </AppButton>
          </div>
        </div>
      </AppCard>

      <AppCard title={`Targets for ${periodLabel}`}>
        <PageToolbar className="!mb-0">
          <ListSearch
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search season, product, or note…"
            aria-label="Search concept targets"
          />
          <ListRefreshButton
            onRefresh={() => targetsQuery.refetch()}
            isRefreshing={targetsQuery.isFetching}
            className="ml-auto"
          />
        </PageToolbar>

        <QueryState
          isLoading={targetsQuery.isLoading}
          isError={targetsQuery.isError}
          error={targetsQuery.error}
          onRetry={() => targetsQuery.refetch()}
          skeletonVariant="table"
        >
          <DataTable
            flush
            columns={[
              {
                key: "season",
                header: "Season",
                render: (row) => row.season?.name ?? "All seasons",
              },
              {
                key: "product",
                header: "Product category",
                render: (row) => row.productType?.name ?? "All categories",
              },
              { key: "targetCount", header: "Target" },
              {
                key: "note",
                header: "Note",
                render: (row) => row.note ?? "-",
              },
            ]}
            rows={list.pageItems}
            getRowKey={(row) => String(row.id)}
            emptyTitle={
              list.search ? "No targets match your search" : "No targets for this period"
            }
            emptyDescription="Save a target above. Saving the same season and category again updates that row."
          />
        </QueryState>

        <PaginationBar
          total={list.total}
          page={list.page}
          pageSize={list.pageSize}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          pageSizeSelectId="concept-targets-page-size"
        />
      </AppCard>
    </div>
  );
}
