"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import { useProcessMasters } from "@/hooks/use-masters";
import type { ProductType, Season } from "@/lib/types/api";

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

  const productTypesQuery = useQuery({
    queryKey: queryKeys.masters.productTypesAdmin,
    queryFn: () => apiGet<ProductType[]>("/api/masters/product-types?includeInactive=1"),
  });

  const seasonsQuery = useQuery({
    queryKey: queryKeys.masters.seasonsAdmin,
    queryFn: () => apiGet<Season[]>("/api/masters/seasons?includeInactive=1"),
  });

  const mappingsQuery = useQuery({
    queryKey: queryKeys.masters.productProcessMappings(),
    queryFn: () => apiGet<ProductProcessMapping[]>("/api/masters/product-process-mappings"),
  });

  const [productTypeOpen, setProductTypeOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [ptCode, setPtCode] = useState("");
  const [ptName, setPtName] = useState("");
  const [seasonCode, setSeasonCode] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [mapProductTypeId, setMapProductTypeId] = useState<number | "">("");
  const [mapProcessId, setMapProcessId] = useState<number | "">("");

  const createProductType = useMutation({
    mutationFn: () => apiPost("/api/masters/product-types", { code: ptCode, name: ptName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.productTypes });
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.productTypesAdmin });
      toast.success("Product type created");
      setProductTypeOpen(false);
      setPtCode("");
      setPtName("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not create product type"),
  });

  const updateProductType = useMutation({
    mutationFn: (payload: { id: number; name?: string; active?: boolean }) =>
      apiPatch(`/api/masters/product-types/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.productTypes });
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.productTypesAdmin });
      toast.success("Product type updated");
    },
    onError: (e) => toast.errorFromApi(e, "Could not update product type"),
  });

  const createSeason = useMutation({
    mutationFn: () => apiPost("/api/masters/seasons", { code: seasonCode, name: seasonName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.seasons });
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.seasonsAdmin });
      toast.success("Season created");
      setSeasonOpen(false);
      setSeasonCode("");
      setSeasonName("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not create season"),
  });

  const updateSeason = useMutation({
    mutationFn: (payload: { id: number; name?: string; active?: boolean }) =>
      apiPatch(`/api/masters/seasons/${payload.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.seasons });
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.seasonsAdmin });
      toast.success("Season updated");
    },
    onError: (e) => toast.errorFromApi(e, "Could not update season"),
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
      toast.success("Process mapping added");
      setMappingOpen(false);
      setMapProductTypeId("");
      setMapProcessId("");
    },
    onError: (e) => toast.errorFromApi(e, "Could not create mapping"),
  });

  const deleteMapping = useMutation({
    mutationFn: (id: number) => apiDelete(`/api/masters/product-process-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.masters.productProcessMappings() });
      toast.success("Mapping removed");
    },
    onError: (e) => toast.errorFromApi(e, "Could not remove mapping"),
  });

  const productTypes = productTypesQuery.data ?? [];
  const seasons = seasonsQuery.data ?? [];
  const processes = processesQuery.data ?? [];
  const mappings = mappingsQuery.data ?? [];

  return (
    <div className="stack-section">
      <AppCard
        className="stack-section"
        title="Product Types"
        headerAction={
          <AppButton type="button" appVariant="primary" size="sm" onClick={() => setProductTypeOpen(true)}>
            Add Product Type
          </AppButton>
        }
      >
        <QueryState
          isLoading={productTypesQuery.isLoading}
          isError={productTypesQuery.isError}
          error={productTypesQuery.error}
          onRetry={() => productTypesQuery.refetch()}
          skeletonVariant="table"
        >
          <DataTable
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Name" },
              {
                key: "active",
                header: "Status",
                render: (row) => (
                  <StatusBadge
                    status={row.active === false ? "CLOSED" : "ACTIVE"}
                    label={row.active === false ? "Inactive" : "Active"}
                  />
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <AppButton
                    type="button"
                    appVariant="secondary"
                    size="sm"
                    disabled={updateProductType.isPending}
                    onClick={() =>
                      updateProductType.mutate({
                        id: row.id,
                        active: row.active === false,
                      })
                    }
                  >
                    {row.active === false ? "Activate" : "Deactivate"}
                  </AppButton>
                ),
              },
            ]}
            rows={productTypes}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No product types"
          />
        </QueryState>
      </AppCard>

      <AppCard
        className="stack-section"
        title="Seasons"
        headerAction={
          <AppButton type="button" appVariant="primary" size="sm" onClick={() => setSeasonOpen(true)}>
            Add Season
          </AppButton>
        }
      >
        <QueryState
          isLoading={seasonsQuery.isLoading}
          isError={seasonsQuery.isError}
          error={seasonsQuery.error}
          onRetry={() => seasonsQuery.refetch()}
          skeletonVariant="table"
        >
          <DataTable
            columns={[
              { key: "code", header: "Code" },
              { key: "name", header: "Name" },
              {
                key: "active",
                header: "Status",
                render: (row) => (
                  <StatusBadge
                    status={row.active === false ? "CLOSED" : "ACTIVE"}
                    label={row.active === false ? "Inactive" : "Active"}
                  />
                ),
              },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <AppButton
                    type="button"
                    appVariant="secondary"
                    size="sm"
                    disabled={updateSeason.isPending}
                    onClick={() =>
                      updateSeason.mutate({
                        id: row.id,
                        active: row.active === false,
                      })
                    }
                  >
                    {row.active === false ? "Activate" : "Deactivate"}
                  </AppButton>
                ),
              },
            ]}
            rows={seasons}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No seasons"
          />
        </QueryState>
      </AppCard>

      <AppCard
        className="stack-section"
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
                key: "productType",
                header: "Product Type",
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
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <AppButton
                    type="button"
                    appVariant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={deleteMapping.isPending}
                    onClick={() => deleteMapping.mutate(row.id)}
                  >
                    Remove
                  </AppButton>
                ),
              },
            ]}
            rows={mappings}
            getRowKey={(row) => String(row.id)}
            emptyTitle="No mappings"
          />
        </QueryState>
      </AppCard>

      <Modal
        open={productTypeOpen}
        title="Add Product Type"
        onClose={() => setProductTypeOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setProductTypeOpen(false)}>Cancel</AppButton>
            <AppButton disabled={!ptCode || !ptName || createProductType.isPending} onClick={() => createProductType.mutate()}>
              Create
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField id="ptCode" label="Code" required value={ptCode} onChange={(e) => setPtCode(e.target.value)} />
          <FormTextField id="ptName" label="Name" required value={ptName} onChange={(e) => setPtName(e.target.value)} />
        </ModalForm>
      </Modal>

      <Modal
        open={seasonOpen}
        title="Add Season"
        onClose={() => setSeasonOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setSeasonOpen(false)}>Cancel</AppButton>
            <AppButton disabled={!seasonCode || !seasonName || createSeason.isPending} onClick={() => createSeason.mutate()}>
              Create
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <FormTextField id="seasonCode" label="Code" required value={seasonCode} onChange={(e) => setSeasonCode(e.target.value)} />
          <FormTextField id="seasonName" label="Name" required value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
        </ModalForm>
      </Modal>

      <Modal
        open={mappingOpen}
        title="Add Product–Process Mapping"
        onClose={() => setMappingOpen(false)}
        footer={
          <ModalFooterActions>
            <AppButton appVariant="outline" onClick={() => setMappingOpen(false)}>Cancel</AppButton>
            <AppButton
              disabled={!mapProductTypeId || !mapProcessId || createMapping.isPending}
              onClick={() => createMapping.mutate()}
            >
              Add
            </AppButton>
          </ModalFooterActions>
        }
      >
        <ModalForm>
          <ModalFormGrid>
            <FormSelect
              id="mapPt"
              label="Product Type"
              required
              value={mapProductTypeId === "" ? null : String(mapProductTypeId)}
              onValueChange={(v) => setMapProductTypeId(v ? Number(v) : "")}
              options={productTypes.filter((pt) => pt.active !== false).map((pt) => ({
                value: String(pt.id),
                label: pt.name,
              }))}
              placeholder="Select product type"
            />
            <FormSelect
              id="mapProc"
              label="Process"
              required
              value={mapProcessId === "" ? null : String(mapProcessId)}
              onValueChange={(v) => setMapProcessId(v ? Number(v) : "")}
              options={processes.map((p) => ({ value: String(p.id), label: p.name }))}
              placeholder="Select process"
            />
          </ModalFormGrid>
        </ModalForm>
      </Modal>
    </div>
  );
}
