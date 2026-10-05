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
import { ListPeriodFilter } from "@/components/ui/ListPeriodFilter";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { ListFilterField } from "@/components/ui/ListFilterField";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Input } from "@/components/ui/input";
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
  const [seasonId, setSeasonId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
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
      { value: "", label: "All seasons" },
      ...(seasons.data ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    ],
    [seasons.data],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "All categories" },
      ...(productTypes.data ?? []).map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    ],
    [productTypes.data],
  );

  const save = useMutation({
    mutationFn: () =>
      apiPost("/api/masters/concept-targets", {
        periodYear: year,
        periodMonth: month,
        targetCount: Number(targetCount) || 0,
        seasonId: seasonId ? Number(seasonId) : null,
        productTypeId: productTypeId ? Number(productTypeId) : null,
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
    <div className="vstack vstack--tight concept-targets-admin">
      <AppCard
        title="Set concept target"
        description="Period applies to both the form below and the targets list."
        headerAction={
          attainment ? (
            <span
              className="concept-targets-admin__attainment"
              title="Created vs target for this period"
            >
              Attainment {attainment.createdCount}/{attainment.targetCount || 0}
              <span className="concept-targets-admin__attainment-pct">
                {attainment.percent}%
              </span>
            </span>
          ) : null
        }
      >
        <div className="concept-targets-admin__form">
          <div className="concept-targets-admin__filters" role="group" aria-label="Concept target period and filters">
            <ListPeriodFilter
              yearId="ct-year"
              monthId="ct-month"
              year={year}
              month={month}
              onYearChange={setYear}
              onMonthChange={setMonth}
            />
            <ListSelectFilter
              id="ct-season"
              label="Season"
              value={seasonId}
              onChange={setSeasonId}
              options={seasonOptions}
              className="concept-targets-admin__select"
            />
            <ListSelectFilter
              id="ct-product"
              label="Category"
              value={productTypeId}
              onChange={setProductTypeId}
              options={productOptions}
              className="concept-targets-admin__select"
            />
            <ListFilterField
              id="ct-count"
              label="Target"
              className="concept-targets-admin__count"
            >
              <Input
                id="ct-count"
                type="number"
                min={0}
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                className="list-filter-control list-filter-control--year !w-auto"
                aria-label="Target count"
              />
            </ListFilterField>
          </div>

          <div className="concept-targets-admin__actions" role="group" aria-label="Concept target note and save">
            <ListFilterField
              id="ct-note"
              label="Note"
              className="concept-targets-admin__note"
            >
              <Input
                id="ct-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                className="list-filter-control concept-targets-admin__note-input"
                aria-label="Note"
              />
            </ListFilterField>
            <AppButton
              type="button"
              size="sm"
              className="concept-targets-admin__save"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save target"}
            </AppButton>
          </div>
        </div>
      </AppCard>

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
              render: (row) => row.season?.name ?? "All",
            },
            {
              key: "product",
              header: "Product",
              render: (row) => row.productType?.name ?? "All",
            },
            { key: "targetCount", header: "Target" },
            {
              key: "note",
              header: "Note",
              render: (row) => row.note ?? "—",
            },
          ]}
          rows={list.pageItems}
          getRowKey={(row) => String(row.id)}
          emptyTitle={
            list.search ? "No targets match your search" : "No targets for this period"
          }
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
    </div>
  );
}
