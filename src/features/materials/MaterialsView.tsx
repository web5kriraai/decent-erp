"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useMasterCatalog } from "@/hooks/use-masters";

type MaterialLine = {
  id: string;
  designId: string;
  unit: string;
  quantity: string | number;
  source: string;
  status: string;
  wastageQty?: string | number | null;
  catalogItem?: { id: number; code: string; name: string; masterType: string };
  design?: { ideaRef: string; collectionName: string };
};

type DesignOption = { id: string; ideaRef: string; collectionName: string };

export function MaterialsView() {
  const toast = useApiToast();
  const queryClient = useQueryClient();
  const fabrics = useMasterCatalog("FABRIC_QUALITY");
  const threads = useMasterCatalog("THREAD");
  const accessories = useMasterCatalog("ACCESSORIES");
  const [open, setOpen] = useState(false);
  const [designId, setDesignId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [unit, setUnit] = useState("mtr");
  const [quantity, setQuantity] = useState("1");
  const [source, setSource] = useState<"STOCK" | "PURCHASE_INDENT">("STOCK");

  const listQuery = useQuery({
    queryKey: queryKeys.masters.materials(),
    queryFn: () => apiGet<MaterialLine[]>("/api/materials"),
  });

  const designsQuery = useQuery({
    queryKey: queryKeys.designs.list(),
    queryFn: () => apiGet<{ items: DesignOption[] }>("/api/designs?limit=50"),
  });

  const catalogOptions = useMemo(
    () => [...(fabrics.data ?? []), ...(threads.data ?? []), ...(accessories.data ?? [])],
    [fabrics.data, threads.data, accessories.data],
  );

  const create = useMutation({
    mutationFn: () =>
      apiPost("/api/materials", {
        designId,
        catalogItemId: Number(catalogItemId),
        unit,
        quantity: Number(quantity),
        source,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.materials() });
      toast.success("Material request created");
      setOpen(false);
    },
    onError: (e) => toast.errorFromApi(e, "Could not create material request"),
  });

  const updateStatus = useMutation({
    mutationFn: (payload: { id: string; status: string }) =>
      apiPatch(`/api/materials/${payload.id}`, { status: payload.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.materials() });
      toast.success("Material line updated");
    },
    onError: (e) => toast.errorFromApi(e, "Could not update material line"),
  });

  const rows = listQuery.data ?? [];
  const requested = rows.filter((r) => r.status === "REQUESTED" || r.status === "INDENT").length;
  const available = rows.filter((r) => r.status === "AVAILABLE").length;
  const issued = rows.filter((r) => r.status === "ISSUED").length;

  return (
    <div className="page-shell">
      <PageHeader
        title="Material & Fabric"
        actions={
          <AppButton type="button" appVariant="primary" onClick={() => setOpen(true)}>
            Request Material
          </AppButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3 stack-section">
        <AppCard title="Open requests"><p className="text-2xl font-semibold m-0">{requested}</p></AppCard>
        <AppCard title="Available"><p className="text-2xl font-semibold m-0">{available}</p></AppCard>
        <AppCard title="Issued"><p className="text-2xl font-semibold m-0">{issued}</p></AppCard>
      </div>

      <AppCard title="Material requirements">
        <QueryState
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          error={listQuery.error}
          onRetry={() => listQuery.refetch()}
          skeletonVariant="table"
        >
          <DataTable
            columns={[
              {
                key: "design",
                header: "Design",
                render: (row) => row.design?.ideaRef ?? row.designId,
              },
              {
                key: "item",
                header: "Item",
                render: (row) => row.catalogItem?.name ?? "—",
              },
              {
                key: "qty",
                header: "Qty",
                render: (row) => `${row.quantity} ${row.unit}`,
              },
              { key: "source", header: "Source" },
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge status="ACTIVE" label={row.status} />,
              },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <div style={{ display: "flex", gap: 6 }}>
                    {row.status !== "AVAILABLE" && row.status !== "ISSUED" ? (
                      <AppButton
                        size="sm"
                        type="button"
                        onClick={() => updateStatus.mutate({ id: row.id, status: "AVAILABLE" })}
                      >
                        Mark Available
                      </AppButton>
                    ) : null}
                    {row.status === "AVAILABLE" ? (
                      <AppButton
                        size="sm"
                        type="button"
                        onClick={() => updateStatus.mutate({ id: row.id, status: "ISSUED" })}
                      >
                        Issue
                      </AppButton>
                    ) : null}
                  </div>
                ),
              },
            ]}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No material lines"
          />
        </QueryState>
      </AppCard>

      <Modal
        open={open}
        title="Request Material"
        onClose={() => setOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              disabled={!designId || !catalogItemId || create.isPending}
              onClick={() => create.mutate()}
            >
              Create
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormSelect
            id="mat-design"
            label="Design"
            required
            value={designId || null}
            onValueChange={setDesignId}
            options={(designsQuery.data?.items ?? []).map((d) => ({
              value: String(d.id),
              label: `${d.ideaRef} — ${d.collectionName}`,
            }))}
            placeholder="Select…"
          />
          <FormSelect
            id="mat-item"
            label="Catalog item"
            required
            value={catalogItemId || null}
            onValueChange={setCatalogItemId}
            options={catalogOptions.map((c) => ({
              value: String(c.id),
              label: `${c.masterType}: ${c.name}`,
            }))}
            placeholder="Select…"
          />
          <FormTextField id="mat-unit" label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <FormTextField
            id="mat-qty"
            label="Quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <FormSelect
            id="mat-source"
            label="Source"
            value={source}
            onValueChange={(v) => setSource(v as "STOCK" | "PURCHASE_INDENT")}
            options={[
              { value: "STOCK", label: "Use Stock" },
              { value: "PURCHASE_INDENT", label: "Purchase Indent" },
            ]}
          />
        </ModalForm>
      </Modal>
    </div>
  );
}
