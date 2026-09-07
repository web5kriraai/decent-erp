"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useProcessMasters, type CatalogMaster } from "@/hooks/use-masters";
import {
  MASTER_HUB_TILES,
  MASTER_TYPE_LABELS,
  type MasterType,
} from "@/lib/master-catalog-types";
import Link from "next/link";

type ProductProcessMapping = {
  id: number;
  productTypeId: number;
  processId: number;
  required: boolean;
  productType?: { id: number; code: string; name: string };
  process?: { id: number; code: string; name: string };
};

export function MasterCatalogView() {
  const queryClient = useQueryClient();
  const toast = useApiToast();
  const processesQuery = useProcessMasters(true);
  const [selectedType, setSelectedType] = useState<MasterType | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogMaster | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [mappingOpen, setMappingOpen] = useState(false);
  const [mapProductTypeId, setMapProductTypeId] = useState<number | "">("");
  const [mapProcessId, setMapProcessId] = useState<number | "">("");

  const catalogQuery = useQuery({
    queryKey: queryKeys.masters.catalog(selectedType ?? undefined, true),
    queryFn: () =>
      apiGet<CatalogMaster[]>(
        `/api/masters/catalog?masterType=${selectedType}&includeInactive=1`,
      ),
    enabled: !!selectedType,
  });

  const countsQuery = useQuery({
    queryKey: queryKeys.masters.catalog(undefined, true),
    queryFn: () => apiGet<CatalogMaster[]>("/api/masters/catalog?includeInactive=1"),
  });

  const countsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of countsQuery.data ?? []) {
      if (!row.masterType) continue;
      map.set(row.masterType, (map.get(row.masterType) ?? 0) + 1);
    }
    return map;
  }, [countsQuery.data]);

  const productTypes = useMemo(
    () => (countsQuery.data ?? []).filter((r) => r.masterType === "PRODUCT_CATEGORY"),
    [countsQuery.data],
  );

  const mappingsQuery = useQuery({
    queryKey: queryKeys.masters.productProcessMappings(),
    queryFn: () => apiGet<ProductProcessMapping[]>("/api/masters/product-process-mappings"),
  });

  const createItem = useMutation({
    mutationFn: () =>
      apiPost("/api/masters/catalog", {
        masterType: selectedType,
        code,
        name,
        description: description || null,
        sortOrder: Number(sortOrder) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters", "catalog"] });
      toast.success("Master item created");
      setCreateOpen(false);
      setCode("");
      setName("");
      setDescription("");
      setSortOrder("0");
    },
    onError: (e) => toast.errorFromApi(e, "Could not create master item"),
  });

  const patchItem = useMutation({
    mutationFn: (payload: {
      id: number;
      name?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    }) => apiPatch(`/api/masters/catalog/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters", "catalog"] });
      toast.success("Master item updated");
      setEditItem(null);
    },
    onError: (e) => toast.errorFromApi(e, "Could not update master item"),
  });

  const createMapping = useMutation({
    mutationFn: () =>
      apiPost("/api/masters/product-process-mappings", {
        productTypeId: Number(mapProductTypeId),
        processId: Number(mapProcessId),
        required: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.productProcessMappings() });
      toast.success("Product–process mapping created");
      setMappingOpen(false);
      setMapProductTypeId("");
      setMapProcessId("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not create mapping"),
  });

  const rows = catalogQuery.data ?? [];

  if (!selectedType) {
    return (
      <div className="vstack vstack--loose">
        <AppCard title="Master Setup" description="Configure design management masters">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {MASTER_HUB_TILES.map((tile) => {
              if (tile.kind === "link") {
                return (
                  <Link
                    key={tile.id}
                    href={tile.href}
                    className="panel"
                    style={{
                      display: "block",
                      padding: 16,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{tile.label}</h3>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                      Open structured master
                    </p>
                  </Link>
                );
              }
              const count = countsByType.get(tile.masterType) ?? 0;
              return (
                <button
                  key={tile.masterType}
                  type="button"
                  onClick={() => setSelectedType(tile.masterType)}
                  style={{
                    textAlign: "left",
                    padding: 16,
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{tile.label}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                    {count} records
                  </p>
                </button>
              );
            })}
          </div>
        </AppCard>

        <AppCard
          title="Product–Process Mappings"
          headerAction={
            <AppButton type="button" appVariant="primary" size="sm" onClick={() => setMappingOpen(true)}>
              Add Mapping
            </AppButton>
          }
        >
          <QueryState
            isLoading={mappingsQuery.isLoading}
            isError={mappingsQuery.isError}
            error={mappingsQuery.error}
            onRetry={() => mappingsQuery.refetch()}
            skeletonVariant="table"
          >
            <DataTable
              columns={[
                {
                  key: "product",
                  header: "Product",
                  render: (row) => row.productType?.name ?? row.productTypeId,
                },
                {
                  key: "process",
                  header: "Process",
                  render: (row) => row.process?.name ?? row.processId,
                },
                {
                  key: "required",
                  header: "Required",
                  render: (row) => (row.required ? "Yes" : "No"),
                },
              ]}
              rows={mappingsQuery.data ?? []}
              getRowKey={(row) => String(row.id)}
              emptyTitle="No product–process mappings"
            />
          </QueryState>
        </AppCard>

        <Modal
          open={mappingOpen}
          title="Add Product–Process Mapping"
          onClose={() => setMappingOpen(false)}
          footer={
            <ModalFooterActions>
              <AppButton appVariant="outline" onClick={() => setMappingOpen(false)}>
                Cancel
              </AppButton>
              <AppButton
                disabled={!mapProductTypeId || !mapProcessId || createMapping.isPending}
                onClick={() => createMapping.mutate()}
              >
                Create
              </AppButton>
            </ModalFooterActions>
          }
        >
          <ModalForm>
            <FormSelect
              id="map-product"
              label="Product category"
              required
              value={mapProductTypeId === "" ? null : String(mapProductTypeId)}
              onValueChange={(v) => setMapProductTypeId(v ? Number(v) : "")}
              options={productTypes.map((pt) => ({
                value: String(pt.id),
                label: pt.name,
              }))}
              placeholder="Select…"
            />
            <FormSelect
              id="map-process"
              label="Process"
              required
              value={mapProcessId === "" ? null : String(mapProcessId)}
              onValueChange={(v) => setMapProcessId(v ? Number(v) : "")}
              options={(processesQuery.data ?? []).map((p) => ({
                value: String(p.id),
                label: p.name,
              }))}
              placeholder="Select…"
            />
          </ModalForm>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <AppCard
        title={MASTER_TYPE_LABELS[selectedType]}
        description={`master_type = ${selectedType}`}
        headerAction={
          <div style={{ display: "flex", gap: 8 }}>
            <AppButton type="button" appVariant="outline" size="sm" onClick={() => setSelectedType(null)}>
              Back
            </AppButton>
            <AppButton type="button" appVariant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              Add Item
            </AppButton>
          </div>
        }
      >
        <QueryState
          isLoading={catalogQuery.isLoading}
          isError={catalogQuery.isError}
          error={catalogQuery.error}
          onRetry={() => catalogQuery.refetch()}
          skeletonVariant="table"
        >
          <DataTable
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Name" },
              {
                key: "description",
                header: "Description",
                render: (row) => row.description || "—",
              },
              {
                key: "sortOrder",
                header: "Sort",
                render: (row) => String(row.sortOrder ?? 0),
              },
              {
                key: "active",
                header: "Status",
                render: (row) => (
                  <StatusBadge
                    status={(row.active ?? row.isActive) === false ? "CLOSED" : "ACTIVE"}
                    label={(row.active ?? row.isActive) === false ? "Inactive" : "Active"}
                  />
                ),
              },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <TableIconActionGroup>
                    <TableIconAction
                      action="edit"
                      label="Edit"
                      onClick={() => {
                        setEditItem(row);
                        setEditName(row.name);
                        setEditDescription(row.description ?? "");
                        setEditSortOrder(String(row.sortOrder ?? 0));
                      }}
                    />
                    <TableIconAction
                      action={(row.active ?? row.isActive) === false ? "activate" : "deactivate"}
                      label={(row.active ?? row.isActive) === false ? "Activate" : "Deactivate"}
                      onClick={() =>
                        patchItem.mutate({
                          id: row.id,
                          isActive: (row.active ?? row.isActive) === false,
                        })
                      }
                    />
                  </TableIconActionGroup>
                ),
              },
            ]}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No catalog items"
          />
        </QueryState>
      </AppCard>

      <Modal
        open={createOpen}
        title={`Add ${MASTER_TYPE_LABELS[selectedType]}`}
        onClose={() => setCreateOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              disabled={!code || !name || createItem.isPending}
              onClick={() => createItem.mutate()}
            >
              Create
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField
            id="mc-code"
            label="Code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <FormTextField
            id="mc-name"
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <FormTextField
            id="mc-desc"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FormTextField
            id="mc-sort"
            label="Sort order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </ModalForm>
      </Modal>

      <Modal
        open={!!editItem}
        title={`Edit ${editItem?.code ?? ""}`}
        onClose={() => setEditItem(null)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </AppButton>
            <AppButton
              disabled={!editName || !editItem || patchItem.isPending}
              onClick={() =>
                editItem &&
                patchItem.mutate({
                  id: editItem.id,
                  name: editName,
                  description: editDescription || null,
                  sortOrder: Number(editSortOrder) || 0,
                })
              }
            >
              Save
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField
            id="mc-edit-name"
            label="Name"
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <FormTextField
            id="mc-edit-desc"
            label="Description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <FormTextField
            id="mc-edit-sort"
            label="Sort order"
            value={editSortOrder}
            onChange={(e) => setEditSortOrder(e.target.value)}
          />
        </ModalForm>
      </Modal>
    </div>
  );
}
