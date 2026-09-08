"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryState } from "@/components/ui/QueryState";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
} from "@/components/ui/Modal";
import { FormTextField } from "@/components/ui/form-text-field";
import { FormSelect } from "@/components/ui/form-select";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { Input } from "@/components/ui/input";
import { TableIconAction, TableIconActionGroup } from "@/components/ui/TableIconAction";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@/components/icons";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiToast } from "@/components/ui/ToastProvider";
import type { CatalogMaster } from "@/hooks/use-masters";
import {
  isMasterType,
  MASTER_HUB_GROUPS,
  MASTER_TYPE_LABELS,
  MASTER_TYPES,
  type MasterHubGroup,
  type MasterHubTile,
  type MasterType,
} from "@/lib/master-catalog-types";
import { WORK_TYPE_OPTIONS } from "@/lib/types/api";
import { PageToolbar } from "@/components/ui/PageToolbar";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "active" | "inactive";

function tileMatchesQuery(tile: MasterHubTile, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  if (tile.label.toLowerCase().includes(q)) return true;
  if (tile.kind === "catalog") {
    return tile.masterType.toLowerCase().includes(q);
  }
  return (
    tile.description.toLowerCase().includes(q) ||
    tile.id.toLowerCase().includes(q)
  );
}

function filterGroups(groups: MasterHubGroup[], query: string): MasterHubGroup[] {
  return groups
    .map((group) => ({
      ...group,
      tiles: group.tiles.filter((tile) => tileMatchesQuery(tile, query)),
    }))
    .filter((group) => group.tiles.length > 0);
}

export function MasterCatalogView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useApiToast();

  const typeParam = searchParams.get("type");
  const selectedType: MasterType | null = isMasterType(typeParam) ? typeParam : null;

  const [hubSearch, setHubSearch] = useState("");
  const [rowSearch, setRowSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogMaster | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");

  function setSelectedType(next: MasterType | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "catalog");
    if (next) params.set("type", next);
    else params.delete("type");
    router.replace(`/admin/masters?${params.toString()}`, { scroll: false });
    setRowSearch("");
    setStatusFilter("all");
    setCreateOpen(false);
    setEditItem(null);
  }

  const catalogQuery = useQuery({
    queryKey: queryKeys.masters.catalog(selectedType ?? undefined, true),
    queryFn: () =>
      apiGet<CatalogMaster[]>(
        `/api/masters/catalog?masterType=${selectedType}&includeInactive=1`,
      ),
    enabled: !!selectedType,
  });

  const countsQuery = useQuery({
    queryKey: queryKeys.masters.catalogSummary(true),
    queryFn: () =>
      apiGet<Record<string, number>>(
        "/api/masters/catalog?summary=1&includeInactive=1",
      ),
  });

  const countsByType = countsQuery.data ?? {};

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

  const filteredGroups = useMemo(
    () => filterGroups(MASTER_HUB_GROUPS, hubSearch.trim()),
    [hubSearch],
  );

  const rows = useMemo(() => {
    const all = catalogQuery.data ?? [];
    const q = rowSearch.trim().toLowerCase();
    return all.filter((row) => {
      const active = (row.active ?? row.isActive) !== false;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        (row.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [catalogQuery.data, rowSearch, statusFilter]);

  if (!selectedType) {
    return (
      <div className="vstack vstack--loose">
        <AppCard
          title="Master Catalog"
          description="Configure flat lookup values used across design, materials, quality, and production."
          headerAction={
            <div className="relative w-full min-w-[12rem] sm:w-64">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search masters…"
                className="pl-8"
                aria-label="Search master types"
              />
            </div>
          }
        >
          {countsQuery.isError ? (
            <p className="mb-4 text-sm text-destructive">
              Could not load record counts.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => countsQuery.refetch()}
              >
                Retry
              </button>
            </p>
          ) : null}

          {filteredGroups.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              No masters match “{hubSearch.trim()}”.
            </p>
          ) : (
            <div className="vstack vstack--loose">
              {filteredGroups.map((group) => (
                <section key={group.id} className="vstack vstack--tight">
                  <div>
                    <h3 className="m-0 text-sm font-semibold text-foreground">
                      {group.title}
                    </h3>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                    {group.tiles.map((tile) => {
                      if (tile.kind === "link") {
                        return (
                          <Link
                            key={tile.id}
                            href={tile.href}
                            className={cn(
                              "group flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-3",
                              "no-underline text-inherit transition-colors hover:border-primary/40 hover:bg-muted/40",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="m-0 text-sm font-medium text-foreground">
                                {tile.label}
                              </p>
                              <p className="m-0 mt-1 text-xs text-muted-foreground">
                                {tile.description}
                              </p>
                            </div>
                            <IconChevronRight
                              size={16}
                              className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </Link>
                        );
                      }

                      const count = countsByType[tile.masterType] ?? 0;
                      return (
                        <button
                          key={tile.masterType}
                          type="button"
                          onClick={() => setSelectedType(tile.masterType)}
                          className={cn(
                            "group flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3.5 py-3 text-left",
                            "transition-colors hover:border-primary/40 hover:bg-muted/40",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="m-0 text-sm font-medium text-foreground">
                              {tile.label}
                            </p>
                            <p className="m-0 mt-1 text-xs text-muted-foreground">
                              {countsQuery.isLoading
                                ? "Loading…"
                                : `${count} record${count === 1 ? "" : "s"}`}
                            </p>
                          </div>
                          <IconChevronRight
                            size={16}
                            className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </AppCard>
      </div>
    );
  }

  return (
    <div className="vstack vstack--loose">
      <AppCard
        title={MASTER_TYPE_LABELS[selectedType]}
        description="Create, edit, and activate or deactivate lookup values."
        flush
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            <AppButton
              type="button"
              appVariant="outline"
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              <IconChevronLeft size={14} aria-hidden />
              All masters
            </AppButton>
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              Add item
            </AppButton>
          </div>
        }
      >
        <PageToolbar className="mb-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={rowSearch}
              onChange={(e) => setRowSearch(e.target.value)}
              placeholder="Filter by code or name…"
              className="pl-8"
              aria-label="Filter catalog items"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "all", label: "All" },
                { id: "active", label: "Active" },
                { id: "inactive", label: "Inactive" },
              ] as const
            ).map((opt) => (
              <AppButton
                key={opt.id}
                type="button"
                size="sm"
                appVariant={statusFilter === opt.id ? "primary" : "secondary"}
                onClick={() => setStatusFilter(opt.id)}
              >
                {opt.label}
              </AppButton>
            ))}
          </div>
        </PageToolbar>

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
                      action={
                        (row.active ?? row.isActive) === false ? "activate" : "deactivate"
                      }
                      label={
                        (row.active ?? row.isActive) === false ? "Activate" : "Deactivate"
                      }
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
            emptyTitle={
              rowSearch || statusFilter !== "all"
                ? "No items match this filter"
                : "No catalog items"
            }
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
          {selectedType === MASTER_TYPES.WORK_TYPE ? (
            <FormSelect
              id="mc-code"
              label="Code"
              required
              value={code || null}
              onValueChange={(v) => {
                const next = v ?? "";
                setCode(next);
                const match = WORK_TYPE_OPTIONS.find((o) => o.value === next);
                if (match && !name) setName(match.label);
              }}
              options={WORK_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: `${o.value} — ${o.label}`,
              }))}
              placeholder="Select work type code…"
            />
          ) : (
            <FormTextField
              id="mc-code"
              label="Code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}
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
