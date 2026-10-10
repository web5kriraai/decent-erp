"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { ListPage } from "@/components/ui/ListPage";
import { PermissionDenied } from "@/components/PermissionDenied";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import {
  Modal,
  ModalFooterActions,
  ModalForm,
  ModalFormGrid,
} from "@/components/ui/Modal";
import { resolveCostingContextActions, WORKFLOW_ACTION_CODES } from "@/lib/workflow-actions";
import type { ResolvedWorkflowAction } from "@/lib/workflow-actions/types";
import { useDesignsList } from "@/hooks/use-designs";
import { useAddCostEntry, useDesignCosts, useSaveExpectedMrp } from "@/hooks/use-costing";
import { PERMISSIONS } from "@/lib/permissions";
import { StatusBadge } from "@/components/StatusBadge";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { ListSelectFilter } from "@/components/ui/ListSelectFilter";
import { useClientList } from "@/hooks/use-client-list";

function formatInr(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `₹${value.toFixed(2)}`;
}

type CostEntry = {
  id: string;
  costType: string;
  costCategory?: string | null;
  description?: string | null;
  amount: string | number;
  enteredBy: { name: string };
  enteredAtUtc: string;
};

const COST_TYPES = [
  { value: "TIME", label: "Time" },
  { value: "MATERIAL", label: "Material" },
  { value: "MACHINE", label: "Machine" },
  { value: "CORRECTION", label: "Correction" },
] as const;

const COST_CATEGORIES = [
  { value: "FABRIC", label: "Fabric" },
  { value: "EMBROIDERY", label: "Embroidery" },
  { value: "STITCHING", label: "Stitching" },
  { value: "SALARY", label: "Salary" },
  { value: "OTHER", label: "Other" },
] as const;

function optionLabel(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  if (!value) return "-";
  return options.find((option) => option.value === value)?.label ?? value.replace(/_/g, " ");
}

function costSearchText(row: CostEntry) {
  return [
    optionLabel(COST_TYPES, row.costType),
    optionLabel(COST_CATEGORIES, row.costCategory),
    row.description,
    row.enteredBy.name,
    row.costType,
    row.costCategory,
  ]
    .filter(Boolean)
    .join(" ");
}

export function CostingView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.COST_VIEW);

  const designsQuery = useDesignsList(canView);
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const costsQuery = useDesignCosts(selectedDesignId, canView && !!selectedDesignId);
  const addCost = useAddCostEntry(selectedDesignId);
  const saveMrp = useSaveExpectedMrp(selectedDesignId);
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [costType, setCostType] = useState<"TIME" | "MATERIAL" | "MACHINE" | "CORRECTION">("TIME");
  const [costCategory, setCostCategory] = useState<
    "FABRIC" | "EMBROIDERY" | "STITCHING" | "SALARY" | "OTHER" | ""
  >("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expectedMrp, setExpectedMrp] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const costs = (costsQuery.data?.costs ?? []) as CostEntry[];
  const visibleCosts = useMemo(
    () =>
      costs.filter((row) => {
        if (typeFilter && row.costType !== typeFilter) return false;
        if (categoryFilter === "NONE") return !row.costCategory;
        if (categoryFilter && (row.costCategory ?? "") !== categoryFilter) return false;
        return true;
      }),
    [costs, typeFilter, categoryFilter],
  );
  const getSearchText = useCallback(costSearchText, []);
  const list = useClientList({
    items: visibleCosts,
    getSearchText,
    filterKey: `${selectedDesignId}|${typeFilter}|${categoryFilter}`,
  });
  const savedMrp = costsQuery.data?.summary?.expectedMrp ?? null;

  useEffect(() => {
    setExpectedMrp(savedMrp != null ? String(savedMrp) : "");
  }, [selectedDesignId, savedMrp]);

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.COST_VIEW} />
      </div>
    );
  }

  const amountError =
    !amount.trim() || Number(amount) <= 0 ? "Amount is required" : undefined;

  function resetEntryForm() {
    setAmount("");
    setDescription("");
    setCostCategory("");
    setCostType("TIME");
    setAttemptedSubmit(false);
  }

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!selectedDesignId || amountError) return;
    await addCost.mutateAsync({
      costType,
      costCategory: costCategory || undefined,
      description: description.trim() || undefined,
      amount: Number(amount),
    });
    resetEntryForm();
    setAddOpen(false);
  }

  async function handleSaveMrp(event: React.FormEvent) {
    event.preventDefault();
    const next = Number(expectedMrp);
    if (!selectedDesignId || !Number.isFinite(next) || next <= 0) return;
    if (savedMrp != null && next === Number(savedMrp)) return;
    await saveMrp.mutateAsync(next);
  }

  function handleAction(action: ResolvedWorkflowAction) {
    if (action.code === WORKFLOW_ACTION_CODES.ADD_COST) {
      setAddOpen(true);
    }
  }

  const summary = costsQuery.data?.summary;
  const costingActions = resolveCostingContextActions({
    designId: selectedDesignId || undefined,
    hasCosting: summary?.hasCosting,
    permissions,
  });
  const marginValue = summary?.mrpMarginAmount ?? null;
  const marginTrend =
    summary?.mrpMarginPercent != null ? `${summary.mrpMarginPercent.toFixed(1)}% of MRP` : null;
  const parsedMrp = Number(expectedMrp);
  const canSaveMrp =
    !!selectedDesignId &&
    expectedMrp.trim() !== "" &&
    Number.isFinite(parsedMrp) &&
    parsedMrp > 0 &&
    (savedMrp == null || parsedMrp !== Number(savedMrp));

  function handleRefresh() {
    void designsQuery.refetch();
    if (selectedDesignId) void costsQuery.refetch();
  }

  return (
    <ListPage
      title="Costing"
        subtitle="Development costs by design"
        className="costing-page"
        filters={
          <>
            <ListSelectFilter
              id="costDesign"
              label="Design"
              value={selectedDesignId}
              onChange={(v) => {
                setSelectedDesignId(v);
                setTypeFilter("");
                setCategoryFilter("");
                setExpectedMrp("");
                setAddOpen(false);
              }}
              options={[
                { value: "", label: "Choose a design…" },
                ...(designsQuery.data?.items ?? []).map((d) => ({
                  value: d.id,
                  label: `${d.ideaRef} - ${d.collectionName}`,
                })),
              ]}
              className="costing-page__design-filter"
            />
            <ListSelectFilter
              id="costTypeFilter"
              label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[{ value: "", label: "All types" }, ...COST_TYPES]}
            />
            <ListSelectFilter
              id="costCategoryFilter"
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "", label: "All categories" },
                ...COST_CATEGORIES,
                { value: "NONE", label: "No category" },
              ]}
            />
          </>
        }
        search={{
          value: list.search,
          onChange: list.setSearch,
          placeholder: "Search type, note, or person…",
          "aria-label": "Search cost entries",
        }}
        onRefresh={handleRefresh}
        isRefreshing={designsQuery.isFetching || costsQuery.isFetching}
        beforeTable={
          selectedDesignId ? (
            <>
              <div className="costing-metrics" aria-label="Cost summary">
                <div className="costing-metric">
                  <span className="costing-metric__label">Total</span>
                  <span className="costing-metric__value">
                    {summary ? formatInr(summary.totalDevCost) : "-"}
                  </span>
                </div>
                <div className="costing-metric">
                  <span className="costing-metric__label">Entries</span>
                  <span className="costing-metric__value">{summary?.entryCount ?? 0}</span>
                </div>
                <div className="costing-metric">
                  <span className="costing-metric__label">Expected MRP</span>
                  <span className="costing-metric__value">
                    {summary?.expectedMrp != null ? formatInr(summary.expectedMrp) : "Not set"}
                  </span>
                  <span className="costing-metric__meta">Selling price</span>
                </div>
                <div className="costing-metric">
                  <span className="costing-metric__label">Margin vs MRP</span>
                  <span className="costing-metric__value">
                    {marginValue != null ? formatInr(marginValue) : "Not set"}
                  </span>
                  <span className="costing-metric__meta">
                    {marginTrend ?? "Selling price minus cost"}
                  </span>
                </div>
              </div>

              <form className="costing-mrp" onSubmit={(event) => void handleSaveMrp(event)}>
                <div className="min-w-0">
                  <p className="m-0 text-sm">Expected MRP is the selling price for this design.</p>
                  <p className="m-0 text-xs text-muted-foreground">
                    Margin vs MRP is that price minus the development cost
                    {summary ? ` (${formatInr(summary.totalDevCost)})` : ""}.
                    {summary?.expectedMrp == null
                      ? " No selling price is saved yet, so both stay blank."
                      : ""}
                  </p>
                </div>
                <div className="costing-mrp__form">
                  <FormTextField
                    id="expectedMrp"
                    label="Expected MRP (₹)"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={expectedMrp}
                    onChange={(event) => setExpectedMrp(event.target.value)}
                    placeholder="Selling price"
                    fieldClassName="costing-mrp__amount"
                  />
                  <AppButton
                    type="submit"
                    appVariant="primary"
                    size="sm"
                    disabled={!canSaveMrp || saveMrp.isPending}
                  >
                    {saveMrp.isPending ? "Saving…" : "Save price"}
                  </AppButton>
                </div>
              </form>

              <div className="costing-type-chips" aria-label="Filter by cost type">
                {COST_TYPES.map((type) => {
                  const typeAmount = Number(summary?.byType?.[type.value] ?? 0);
                  const active = typeFilter === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={active ? "costing-type-chip is-current" : "costing-type-chip"}
                      aria-pressed={active}
                      onClick={() =>
                        setTypeFilter((current) => (current === type.value ? "" : type.value))
                      }
                    >
                      <span className="costing-type-chip__type">{type.label}</span>
                      <span className="costing-type-chip__amount">{formatInr(typeAmount)}</span>
                      <span className="costing-type-chip__share">
                        {summary && summary.totalDevCost > 0
                          ? `${((typeAmount / summary.totalDevCost) * 100).toFixed(0)}%`
                          : "0%"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null
        }
        query={
          selectedDesignId
            ? {
                isLoading: costsQuery.isLoading,
                isError: costsQuery.isError,
                error: costsQuery.error,
                onRetry: () => costsQuery.refetch(),
                skeletonVariant: "table",
              }
            : undefined
        }
        pagination={
          selectedDesignId
            ? {
                total: list.total,
                page: list.page,
                pageSize: list.pageSize,
                onPageChange: list.setPage,
                onPageSizeChange: list.setPageSize,
                pageSizeSelectId: "costing-page-size",
              }
            : undefined
        }
        overlays={
          <Modal
            open={addOpen}
            title="Add cost entry"
            onClose={() => {
              if (addCost.isPending) return;
              setAddOpen(false);
              resetEntryForm();
            }}
            size="md"
            footer={
              <ModalFooterActions>
                <AppButton
                  type="button"
                  appVariant="outline"
                  disabled={addCost.isPending}
                  onClick={() => {
                    setAddOpen(false);
                    resetEntryForm();
                  }}
                >
                  Cancel
                </AppButton>
                <AppButton
                  type="submit"
                  form="costing-add-entry-form"
                  appVariant="primary"
                  disabled={addCost.isPending}
                >
                  {addCost.isPending ? "Saving…" : "Add entry"}
                </AppButton>
              </ModalFooterActions>
            }
          >
            <form id="costing-add-entry-form" onSubmit={handleAddCost} noValidate>
              <ModalForm>
                <ModalFormGrid>
                  <FormSelect
                    id="costType"
                    label="Type"
                    required
                    value={costType}
                    onValueChange={(v) => setCostType(v as typeof costType)}
                    options={[
                      { value: "TIME", label: "Time" },
                      { value: "MATERIAL", label: "Material" },
                      { value: "MACHINE", label: "Machine" },
                      { value: "CORRECTION", label: "Correction" },
                    ]}
                  />
                  <FormSelect
                    id="costCategory"
                    label="R&D category"
                    value={costCategory || null}
                    onValueChange={(v) => setCostCategory((v || "") as typeof costCategory)}
                    options={[
                      { value: "FABRIC", label: "Fabric" },
                      { value: "EMBROIDERY", label: "Embroidery" },
                      { value: "STITCHING", label: "Stitching" },
                      { value: "SALARY", label: "Salary hours" },
                      { value: "OTHER", label: "Other" },
                    ]}
                    placeholder="Optional"
                  />
                </ModalFormGrid>
                <ModalFormGrid>
                  <FormTextField
                    id="costAmount"
                    label="Amount (₹)"
                    required
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    error={attemptedSubmit ? amountError : undefined}
                  />
                  <FormTextField
                    id="costDesc"
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short note"
                  />
                </ModalFormGrid>
              </ModalForm>
            </form>
          </Modal>
        }
      >
        {!selectedDesignId ? (
          <AppCard flat>
            <p className="m-0 text-sm text-muted-foreground">
              Choose a design above. The ledger then shows time, material, machine, and correction costs for that design.
            </p>
          </AppCard>
        ) : (
          <AppCard
            title="Cost ledger"
            flush
            className="costing-page__ledger"
            headerAction={
              <div className="costing-ledger-actions">
                {summary?.hasCosting ? (
                  <StatusBadge status="COMPLETED" label="Ready" />
                ) : (
                  <StatusBadge status="CHECKING" label="Needs costs" />
                )}
                <ContextualActionsPanel
                  actions={costingActions}
                  onAction={handleAction}
                  showDisabled={false}
                />
              </div>
            }
          >
            <DataTable
              flush
              columns={[
                {
                  key: "costType",
                  header: "Type",
                  render: (r) => optionLabel(COST_TYPES, r.costType),
                },
                {
                  key: "costCategory",
                  header: "Category",
                  render: (r) => optionLabel(COST_CATEGORIES, r.costCategory),
                },
                {
                  key: "description",
                  header: "Description",
                  render: (r) => r.description ?? "-",
                },
                {
                  key: "amount",
                  header: "Amount",
                  align: "right",
                  render: (r) => formatInr(Number(r.amount)),
                },
                {
                  key: "enteredBy",
                  header: "By",
                  render: (r) => r.enteredBy.name,
                },
                {
                  key: "enteredAtUtc",
                  header: "Date",
                  render: (r) => new Date(r.enteredAtUtc).toLocaleDateString(),
                },
              ]}
              rows={list.pageItems}
              getRowKey={(r) => r.id}
              emptyTitle={costs.length > 0 ? "No entries match" : "No cost entries"}
              emptyDescription={
                costs.length > 0
                  ? "Clear the search or filters to see the other lines."
                  : "Use Add Cost Entry to record the first line."
              }
            />
          </AppCard>
        )}
    </ListPage>
  );
}
