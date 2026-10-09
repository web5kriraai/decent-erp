"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormTextField } from "@/components/ui/form-text-field";
import { useApiToast } from "@/components/ui/ToastProvider";
import { QueryState } from "@/components/ui/QueryState";

type BomResponse = {
  lines: Array<{
    id: string;
    itemCode: string | null;
    itemName: string;
    quantity: string;
    unit: string;
    wastePercent: string | null;
    estimatedUnitCost: string | null;
    parentLineId: string | null;
  }>;
  rollup: { lineCount: number; estimatedTotal: number };
};

export function DesignBomPanel({ designId }: { designId: string }) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [unitCost, setUnitCost] = useState("");

  const query = useQuery({
    queryKey: ["designs", designId, "bom"],
    queryFn: () => apiGet<BomResponse>(`/api/designs/${designId}/bom`),
    enabled: !!designId,
  });

  const create = useMutation({
    mutationFn: () =>
      apiPost(`/api/designs/${designId}/bom`, {
        itemName,
        quantity: Number(quantity),
        unit,
        estimatedUnitCost: unitCost ? Number(unitCost) : undefined,
      }),
    onSuccess: () => {
      toast.success("BOM line added");
      setItemName("");
      setQuantity("1");
      setUnitCost("");
      queryClient.invalidateQueries({ queryKey: ["designs", designId, "bom"] });
    },
    onError: (e) => toast.errorFromApi(e, "Could not add BOM line"),
  });

  const lines = (query.data?.lines ?? []).map((line) => ({
    ...line,
    label: `${line.parentLineId ? "↳ " : ""}${line.itemName}${line.itemCode ? ` (${line.itemCode})` : ""}`,
  }));
  const estimatedTotal = query.data?.rollup.estimatedTotal ?? 0;

  return (
    <AppCard
      title="Material list"
      description="Cloth, embroidery, and other items for this design. Quantity times unit cost is the material estimate."
      flush
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
      >
        <DataTable<(typeof lines)[number] & Record<string, unknown>>
          flush
          columns={[
            { key: "label", header: "Item" },
            {
              key: "quantity",
              header: "Qty",
              render: (row) => `${row.quantity} ${row.unit}`,
            },
            {
              key: "estimatedUnitCost",
              header: "Unit cost",
              align: "right",
              render: (row) =>
                row.estimatedUnitCost != null ? `₹${row.estimatedUnitCost}` : "-",
            },
          ]}
          rows={lines as ((typeof lines)[number] & Record<string, unknown>)[]}
          getRowKey={(row) => row.id}
          emptyTitle="No materials yet"
          emptyDescription="Add cloth, embroidery, or trims below. The total updates from quantity times unit cost."
        />
      </QueryState>

      <div className="space-y-3 border-t border-border px-4 py-4 sm:px-5">
        <p className="m-0 text-sm text-foreground">
          Estimated material total:{" "}
          <strong>₹{Math.round(estimatedTotal).toLocaleString("en-IN")}</strong>
        </p>
        <div className="grid gap-2 sm:grid-cols-4">
        <FormTextField
          id={`bom-name-${designId}`}
          label="Item"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
        <FormTextField
          id={`bom-qty-${designId}`}
          label="Qty"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <FormTextField
          id={`bom-unit-${designId}`}
          label="Unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <FormTextField
          id={`bom-cost-${designId}`}
          label="Unit cost"
          type="number"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
        />
      </div>
      <AppButton
        type="button"
        size="sm"
        disabled={!itemName.trim() || create.isPending}
        onClick={() => create.mutate()}
      >
        Add material
      </AppButton>
      </div>
    </AppCard>
  );
}
