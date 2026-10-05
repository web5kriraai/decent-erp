"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { AppButton } from "@/components/ui/AppButton";
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-sm">Engineering BOM</h3>
        <p className="text-xs text-muted-foreground">
          Multi-level bill of materials (qty × unit cost, optional waste %). Estimated total:{" "}
          <strong>{query.data?.rollup.estimatedTotal ?? 0}</strong>
        </p>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
      >
        <ul className="space-y-1 text-sm">
          {(query.data?.lines ?? []).map((line) => (
            <li key={line.id} className="flex justify-between gap-2 border-b py-1">
              <span>
                {line.parentLineId ? "↳ " : ""}
                {line.itemName}
                {line.itemCode ? ` (${line.itemCode})` : ""}
              </span>
              <span className="text-muted-foreground whitespace-nowrap">
                {line.quantity} {line.unit}
                {line.estimatedUnitCost != null ? ` · ₹${line.estimatedUnitCost}` : ""}
              </span>
            </li>
          ))}
          {(query.data?.lines.length ?? 0) === 0 ? (
            <li className="text-muted-foreground">No BOM lines yet.</li>
          ) : null}
        </ul>
      </QueryState>

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
        Add BOM line
      </AppButton>
    </div>
  );
}
