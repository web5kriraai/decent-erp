"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { apiPost } from "@/lib/api-client";
import { useApiToast } from "@/components/ui/ToastProvider";
import {
  useConceptTargets,
  useProductTypes,
  useSeasons,
} from "@/hooks/use-masters";

export function ConceptTargetsAdminView() {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(String(now.getUTCFullYear()));
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));
  const [targetCount, setTargetCount] = useState("10");
  const [seasonId, setSeasonId] = useState<number | "">("");
  const [productTypeId, setProductTypeId] = useState<number | "">("");
  const [note, setNote] = useState("");

  const y = Number(year) || now.getUTCFullYear();
  const m = Number(month) || now.getUTCMonth() + 1;

  const targetsQuery = useConceptTargets(true, y, m);
  const seasons = useSeasons(true);
  const productTypes = useProductTypes(true);

  const save = useMutation({
    mutationFn: () =>
      apiPost("/api/masters/concept-targets", {
        periodYear: y,
        periodMonth: m,
        targetCount: Number(targetCount) || 0,
        seasonId: seasonId === "" ? null : Number(seasonId),
        productTypeId: productTypeId === "" ? null : Number(productTypeId),
        note: note.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters", "concept-targets"] });
      toast.success("Concept target saved");
      setNote("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not save concept target"),
  });

  const rows = targetsQuery.data?.targets ?? [];
  const attainment = targetsQuery.data?.attainment;

  return (
    <div className="vstack vstack--loose">
      <AppCard
        title="Concept Targets"
        description="Monthly idea targets by season / product category (master catalog)"
      >
        <div className="form-grid form-grid--2" style={{ maxWidth: 720 }}>
          <FormTextField
            id="ct-year"
            label="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
          <FormTextField
            id="ct-month"
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <FormSelect
            id="ct-season"
            label="Season (optional)"
            value={seasonId === "" ? null : String(seasonId)}
            onValueChange={(v) => setSeasonId(v ? Number(v) : "")}
            options={(seasons.data ?? []).map((s) => ({
              value: String(s.id),
              label: s.name,
            }))}
            placeholder="All seasons"
          />
          <FormSelect
            id="ct-product"
            label="Product category (optional)"
            value={productTypeId === "" ? null : String(productTypeId)}
            onValueChange={(v) => setProductTypeId(v ? Number(v) : "")}
            options={(productTypes.data ?? []).map((p) => ({
              value: String(p.id),
              label: p.name,
            }))}
            placeholder="All categories"
          />
          <FormTextField
            id="ct-count"
            label="Target count"
            value={targetCount}
            onChange={(e) => setTargetCount(e.target.value)}
          />
          <FormTextField
            id="ct-note"
            label="Note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="vstack vstack--tight mt-3">
          <AppButton
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save target"}
          </AppButton>
          {attainment ? (
            <p className="m-0 text-sm text-muted-foreground">
              {attainment.hasTarget
                ? `Created ${attainment.createdCount}/${attainment.targetCount} (${attainment.percent}%) · Pass ${attainment.passCount} · Made ${attainment.madeCount} · Hold ${attainment.holdCount} · Reject ${attainment.rejectCount} (${attainment.passPercent}% pass)`
                : `No target set for ${m}/${y}. Created ${attainment.createdCount} · Pass ${attainment.passCount} · Made ${attainment.madeCount}. Save a target above to track attainment.`}
            </p>
          ) : null}
        </div>
      </AppCard>

      <AppCard title={`Targets · ${m}/${y}`}>
        <QueryState
          isLoading={targetsQuery.isLoading}
          isError={targetsQuery.isError}
          error={targetsQuery.error}
          onRetry={() => targetsQuery.refetch()}
          skeletonVariant="table"
        >
          <DataTable
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
            rows={rows}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No targets for this period"
          />
        </QueryState>
      </AppCard>
    </div>
  );
}
