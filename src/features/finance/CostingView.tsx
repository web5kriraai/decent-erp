"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { ContextualActionsPanel } from "@/components/ui/ContextualActionsPanel";
import { resolveCostingContextActions } from "@/lib/workflow-actions";
import { useDesignsList } from "@/hooks/use-designs";
import { useAddCostEntry, useDesignCosts } from "@/hooks/use-costing";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { StatusBadge } from "@/components/StatusBadge";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";

export function CostingView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = permissions.includes(PERMISSIONS.COST_VIEW);

  const designsQuery = useDesignsList(canView);
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const costsQuery = useDesignCosts(selectedDesignId, canView && !!selectedDesignId);
  const addCost = useAddCostEntry(selectedDesignId);

  const [costType, setCostType] = useState<"TIME" | "MATERIAL" | "MACHINE" | "CORRECTION">("TIME");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const selectedDesign = useMemo(
    () => designsQuery.data?.items.find((d) => d.id === selectedDesignId) ?? null,
    [designsQuery.data?.items, selectedDesignId],
  );

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.COST_VIEW} />
      </div>
    );
  }

  const amountError =
    !amount.trim() || Number(amount) <= 0 ? "Amount is required" : undefined;

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    setAttemptedSubmit(true);
    if (!selectedDesignId || amountError) return;
    await addCost.mutateAsync({
      costType,
      description: description.trim() || undefined,
      amount: Number(amount),
    });
    setAmount("");
    setDescription("");
    setAttemptedSubmit(false);
  }

  const summary = costsQuery.data?.summary;
  const costingActions = resolveCostingContextActions({
    designId: selectedDesignId || undefined,
    hasCosting: summary?.hasCosting,
    permissions,
  });
  const byTypeEntries = summary ? Object.entries(summary.byType) : [];

  return (
    <div className="page-shell">
      <PageHeader
        title="Costing"
        subtitle={selectedDesign ? selectedDesign.ideaRef : undefined}
        actions={
          <div className="form-group m-0 min-w-[14rem]">
            <label className="form-label" htmlFor="costDesign">
              Design
            </label>
            <select
              id="costDesign"
              className="form-select"
              value={selectedDesignId}
              onChange={(e) => setSelectedDesignId(e.target.value)}
            >
              <option value="">Choose a design…</option>
              {designsQuery.data?.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.ideaRef} — {d.collectionName}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {!selectedDesignId ? (
        <AppCard className="stack-section">
          <p className="m-0 text-sm text-muted-foreground">Select a design.</p>
        </AppCard>
      ) : (
        <>
          <div className="stat-grid stack-section">
            <StatCard
              label="Total"
              value={summary ? `₹${summary.totalDevCost.toFixed(2)}` : "—"}
              tone={summary?.hasCosting ? "success" : "warning"}
              trend={summary?.hasCosting ? "Ready" : "Incomplete"}
            />
            <StatCard label="Entries" value={String(summary?.entryCount ?? 0)} />
            <StatCard
              label="Estimated"
              value={
                summary?.estimatedCost != null ? `₹${summary.estimatedCost.toFixed(2)}` : "—"
              }
            />
            <StatCard
              label="Margin"
              value={
                summary?.marginAmount != null ? `₹${summary.marginAmount.toFixed(2)}` : "—"
              }
              trend={
                summary?.marginPercent != null
                  ? `${summary.marginPercent.toFixed(1)}%`
                  : undefined
              }
            />
          </div>

          {byTypeEntries.length > 0 ? (
            <AppCard title="By type" className="stack-section" flat>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byTypeEntries.map(([type, typeAmount]) => (
                      <tr key={type} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4">{type.replace(/_/g, " ")}</td>
                        <td className="py-2 pr-4">₹{Number(typeAmount).toFixed(2)}</td>
                        <td className="py-2 text-muted-foreground">
                          {summary && summary.totalDevCost > 0
                            ? `${((Number(typeAmount) / summary.totalDevCost) * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AppCard>
          ) : null}

          <QueryState
            isLoading={costsQuery.isLoading}
            isError={costsQuery.isError}
            error={costsQuery.error}
            onRetry={() => costsQuery.refetch()}
          >
            <AppCard
              title="Cost ledger"
              className="stack-section"
              flush
              headerAction={
                <div className="flex flex-wrap items-center gap-2">
                  {summary?.hasCosting ? (
                    <StatusBadge status="COMPLETED" label="Ready" />
                  ) : (
                    <StatusBadge status="PENDING" label="Needs costs" />
                  )}
                  <Link
                    href={ROUTES.designs.detail(selectedDesignId)}
                    className="data-table-link text-sm"
                  >
                    Open design
                  </Link>
                </div>
              }
            >
              {costingActions.length > 0 ? (
                <div className="border-b border-border px-4 py-2">
                  <ContextualActionsPanel actions={costingActions} />
                </div>
              ) : null}
              <DataTable
                columns={[
                  { key: "costType", header: "Type" },
                  {
                    key: "description",
                    header: "Description",
                    render: (r) => r.description ?? "—",
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (r) => `₹${Number(r.amount).toFixed(2)}`,
                  },
                  {
                    key: "enteredBy",
                    header: "Entered by",
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
                emptyDescription="Add an entry below."
              />
            </AppCard>
          </QueryState>

          <AppCard title="Add entry" className="form-card stack-section">
            <form onSubmit={handleAddCost} noValidate>
              <div className="form-grid form-grid--2">
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
              </div>
              <FormTextField
                id="costDesc"
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <AppButton type="submit" appVariant="primary" disabled={addCost.isPending}>
                Add entry
              </AppButton>
            </form>
          </AppCard>
        </>
      )}
    </div>
  );
}
