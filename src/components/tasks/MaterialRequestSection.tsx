"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton } from "@/components/ui/AppButton";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { ModalAlert, ModalSection } from "@/components/ui/Modal";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useMasterCatalog, type CatalogMaster } from "@/hooks/use-masters";
import { apiGet, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

type MaterialLine = {
  id: string;
  unit: string;
  quantity: string | number;
  source: string;
  status: string;
  catalogItem?: { name: string } | null;
};

const OPEN_STATUSES = new Set(["REQUESTED", "INDENT", "AVAILABLE"]);

const SOURCE_LABEL: Record<string, string> = {
  STOCK: "Stock",
  PURCHASE_INDENT: "Purchase indent",
};

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  INDENT: "Indent",
  AVAILABLE: "Available",
  ISSUED: "Issued",
};

function catalogOptions(items: CatalogMaster[] | undefined, label: string) {
  return (items ?? []).map((item) => ({
    value: String(item.id),
    label: `${label}: ${item.name}`,
  }));
}

export function MaterialRequestSection({
  designId,
  mode,
  onBlockingChange,
}: {
  designId: string;
  mode: "MAT_REQ" | "FABRIC_ISSUE";
  onBlockingChange: (blocking: boolean) => void;
}) {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const fabrics = useMasterCatalog("FABRIC_QUALITY", mode === "MAT_REQ");
  const threads = useMasterCatalog("THREAD", mode === "MAT_REQ");
  const accessories = useMasterCatalog("ACCESSORIES", mode === "MAT_REQ");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [unit, setUnit] = useState("mtr");
  const [quantity, setQuantity] = useState("1");
  const [source, setSource] = useState<"STOCK" | "PURCHASE_INDENT">("STOCK");

  const linesQuery = useQuery({
    queryKey: queryKeys.masters.materials(designId),
    queryFn: () => apiGet<MaterialLine[]>(`/api/materials?designId=${encodeURIComponent(designId)}`),
    enabled: !!designId,
  });

  const lines = linesQuery.data ?? [];
  const openCount = lines.filter((line) => OPEN_STATUSES.has(line.status)).length;
  const availableCount = lines.filter((line) => line.status === "AVAILABLE").length;
  const blocking =
    linesQuery.isLoading ||
    linesQuery.isError ||
    (mode === "MAT_REQ" ? openCount === 0 : availableCount === 0);

  useEffect(() => {
    onBlockingChange(blocking);
    return () => onBlockingChange(false);
  }, [blocking, onBlockingChange]);

  const options = useMemo(
    () => [
      ...catalogOptions(fabrics.data, "Fabric"),
      ...catalogOptions(threads.data, "Thread"),
      ...catalogOptions(accessories.data, "Accessory"),
    ],
    [fabrics.data, threads.data, accessories.data],
  );

  const create = useMutation({
    mutationFn: () =>
      apiPost("/api/materials", {
        designId,
        catalogItemId: Number(catalogItemId),
        unit: unit.trim() || "mtr",
        quantity: Number(quantity),
        source,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters", "materials"] });
      toast.success("Material request created");
      setCatalogItemId("");
      setQuantity("1");
    },
    onError: (error) => toast.errorFromApi(error, "Could not create material request"),
  });

  const qtyOk = Number(quantity) > 0;
  const canCreate = !!catalogItemId && qtyOk && !!unit.trim() && !create.isPending;

  const needsRequest = mode === "MAT_REQ" && !linesQuery.isLoading && !linesQuery.isError && openCount === 0;
  const needsAvailable =
    mode === "FABRIC_ISSUE" && !linesQuery.isLoading && !linesQuery.isError && availableCount === 0;

  return (
    <ModalSection title={mode === "MAT_REQ" ? "Material request" : "Material lines"}>
      <div className="flex flex-col gap-4">
        {linesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading material lines…</p>
        ) : null}

        {linesQuery.isError ? (
          <ModalAlert variant="error">Could not load material lines.</ModalAlert>
        ) : null}

        {needsRequest ? (
          <ModalAlert variant="warning">
            No material request on this design yet. Add fabric, thread, or an accessory from stock
            or as a purchase indent.
          </ModalAlert>
        ) : null}

        {needsAvailable ? (
          <ModalAlert variant="warning">
            Material lines must be Available before this stage can be completed.
          </ModalAlert>
        ) : null}

        {lines.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-border overflow-hidden rounded-md border border-border p-0">
            {lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-card px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{line.catalogItem?.name ?? "Item"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {line.quantity} {line.unit} · {SOURCE_LABEL[line.source] ?? line.source} ·{" "}
                  {STATUS_LABEL[line.status] ?? line.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {mode === "MAT_REQ" ? (
          <div className="flex flex-col gap-4">
            <FormSelect
              id="end-mat-item"
              label="Catalog item"
              required
              value={catalogItemId || null}
              onValueChange={setCatalogItemId}
              options={options}
              placeholder={
                fabrics.isLoading || threads.isLoading || accessories.isLoading
                  ? "Loading catalog…"
                  : options.length === 0
                    ? "No catalog items"
                    : "Select fabric, thread, or accessory…"
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormSelect
                id="end-mat-source"
                label="Source"
                value={source}
                onValueChange={(value) => setSource(value as "STOCK" | "PURCHASE_INDENT")}
                options={[
                  { value: "STOCK", label: "Use stock" },
                  { value: "PURCHASE_INDENT", label: "Purchase indent" },
                ]}
              />
              <FormTextField
                id="end-mat-unit"
                label="Unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              />
              <FormTextField
                id="end-mat-qty"
                label="Quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <AppButton type="button" disabled={!canCreate} onClick={() => create.mutate()}>
                {create.isPending ? "Adding…" : "Add material request"}
              </AppButton>
            </div>
          </div>
        ) : null}
      </div>
    </ModalSection>
  );
}
