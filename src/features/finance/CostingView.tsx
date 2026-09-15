"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
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
import { useAddCostEntry, useDesignCosts } from "@/hooks/use-costing";
import { PERMISSIONS } from "@/lib/permissions";
import { StatusBadge } from "@/components/StatusBadge";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { PageToolbar } from "@/components/ui/PageToolbar";

function formatInr(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `₹${value.toFixed(2)}`;
}

export function CostingView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.COST_VIEW);

  const designsQuery = useDesignsList(canView);
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const costsQuery = useDesignCosts(selectedDesignId, canView && !!selectedDesignId);
  const addCost = useAddCostEntry(selectedDesignId);

  const [addOpen, setAddOpen] = useState(false);
  const [costType, setCostType] = useState<"TIME" | "MATERIAL" | "MACHINE" | "CORRECTION">("TIME");
  const [costCategory, setCostCategory] = useState<
    "FABRIC" | "EMBROIDERY" | "STITCHING" | "SALARY" | "OTHER" | ""
  >("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expectedMrp, setExpectedMrp] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [savingMrp, setSavingMrp] = useState(false);

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

  async function handleSaveMrp() {
    if (!selectedDesignId || !expectedMrp.trim()) return;
    setSavingMrp(true);
    try {
      const { apiPatch } = await import("@/lib/api-client");
      await apiPatch(`/api/designs/${selectedDesignId}/costs`, {
        expectedMrp: Number(expectedMrp),
      });
      await costsQuery.refetch();
    } finally {
      setSavingMrp(false);
    }
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
  const byTypeEntries = summary ? Object.entries(summary.byType) : [];
  const marginValue =
    summary?.mrpMarginAmount != null
      ? summary.mrpMarginAmount
      : summary?.marginAmount != null
        ? summary.marginAmount
        : null;
  const marginTrend =
    summary?.mrpMarginPercent != null
      ? `${summary.mrpMarginPercent.toFixed(1)}%`
      : summary?.marginPercent != null
        ? `${summary.marginPercent.toFixed(1)}%`
        : null;

  return (
    <div className="page-shell costing-page">
      <PageHeader title="Costing" subtitle="Development costs by design" />

      <PageToolbar className="!mb-0">
        <FormSelect
          id="costDesign"
          label=""
          value={selectedDesignId || null}
          onValueChange={(v) => {
            setSelectedDesignId(v ?? "");
            setExpectedMrp("");
            setAddOpen(false);
          }}
          options={(designsQuery.data?.items ?? []).map((d) => ({
            value: d.id,
            label: `${d.ideaRef} — ${d.collectionName}`,
          }))}
          placeholder="Choose a design…"
          className="costing-page__design-select form-group--flat"
          triggerClassName="page-toolbar-select costing-page__design-trigger"
          contentClassName="min-w-[min(36rem,calc(100vw-2rem))]"
        />
      </PageToolbar>

      {!selectedDesignId ? (
        <AppCard flat>
          <p className="m-0 text-sm text-muted-foreground">
            Select a design to open its cost ledger.
          </p>
        </AppCard>
      ) : (
        <div className="costing-page__body vstack vstack--tight">
          <div className="costing-metrics" aria-label="Cost summary">
            <div className="costing-metric">
              <span className="costing-metric__label">Total</span>
              <span className="costing-metric__value">
                {summary ? formatInr(summary.totalDevCost) : "—"}
              </span>
            </div>
            <div className="costing-metric">
              <span className="costing-metric__label">Entries</span>
              <span className="costing-metric__value">{summary?.entryCount ?? 0}</span>
            </div>
            <div className="costing-metric">
              <span className="costing-metric__label">Expected MRP</span>
              <span className="costing-metric__value">
                {formatInr(summary?.expectedMrp ?? null)}
              </span>
            </div>
            <div className="costing-metric">
              <span className="costing-metric__label">Margin vs MRP</span>
              <span className="costing-metric__value">{formatInr(marginValue)}</span>
              {marginTrend ? (
                <span className="costing-metric__meta">{marginTrend}</span>
              ) : null}
            </div>
          </div>

          {byTypeEntries.length > 0 ? (
            <div className="costing-type-chips" aria-label="Cost by type">
              {byTypeEntries.map(([type, typeAmount]) => (
                <span key={type} className="costing-type-chip">
                  <span className="costing-type-chip__type">
                    {type.replace(/_/g, " ")}
                  </span>
                  <span className="costing-type-chip__amount">
                    {formatInr(Number(typeAmount))}
                  </span>
                  <span className="costing-type-chip__share">
                    {summary && summary.totalDevCost > 0
                      ? `${((Number(typeAmount) / summary.totalDevCost) * 100).toFixed(0)}%`
                      : "—"}
                  </span>
                </span>
              ))}
            </div>
          ) : null}

          <QueryState
            isLoading={costsQuery.isLoading}
            isError={costsQuery.isError}
            error={costsQuery.error}
            onRetry={() => costsQuery.refetch()}
            skeletonVariant="table"
          >
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
              <div
                className={
                  (costsQuery.data?.costs?.length ?? 0) > 0
                    ? "costing-ledger-body costing-ledger-body--scroll"
                    : "costing-ledger-body"
                }
              >
                <DataTable
                  flush
                  columns={[
                    { key: "costType", header: "Type" },
                    {
                      key: "costCategory",
                      header: "Category",
                      render: (r) =>
                        (r as { costCategory?: string | null }).costCategory?.replace(
                          /_/g,
                          " ",
                        ) ?? "—",
                    },
                    {
                      key: "description",
                      header: "Description",
                      render: (r) => r.description ?? "—",
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
                  rows={costsQuery.data?.costs ?? []}
                  getRowKey={(r) => r.id}
                  emptyTitle="No cost entries"
                  emptyDescription="Use Add Cost Entry to record the first line."
                />
              </div>
            </AppCard>
          </QueryState>
        </div>
      )}

      <Modal
        open={addOpen}
        title="Add cost entry"
        onClose={() => {
          if (addCost.isPending || savingMrp) return;
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
                id="expectedMrp"
                label="Expected MRP (₹)"
                type="number"
                min={0.01}
                step="0.01"
                value={expectedMrp}
                onChange={(e) => setExpectedMrp(e.target.value)}
                placeholder={
                  summary?.expectedMrp != null
                    ? String(summary.expectedMrp)
                    : "Optional update"
                }
              />
            </ModalFormGrid>
            <FormTextField
              id="costDesc"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short note"
            />
            {expectedMrp.trim() ? (
              <AppButton
                type="button"
                appVariant="secondary"
                size="sm"
                disabled={savingMrp || !selectedDesignId}
                onClick={() => void handleSaveMrp()}
              >
                {savingMrp ? "Saving MRP…" : "Save Expected MRP"}
              </AppButton>
            ) : null}
          </ModalForm>
        </form>
      </Modal>
    </div>
  );
}
