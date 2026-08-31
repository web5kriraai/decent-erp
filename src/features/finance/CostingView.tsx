"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { useDesignsList } from "@/hooks/use-designs";
import { useAddCostEntry, useDesignCosts } from "@/hooks/use-costing";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";

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

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.COST_VIEW} />
      </div>
    );
  }

  async function handleAddCost(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDesignId || !amount) return;
    await addCost.mutateAsync({
      costType,
      description: description.trim() || undefined,
      amount: Number(amount),
    });
    setAmount("");
    setDescription("");
  }

  const summary = costsQuery.data?.summary;

  return (
    <div className="page-shell">
      <PageHeader
        title="Costing"
        subtitle="Development cost, standard cost, and margin review per design"
      />

      <div className="form-group" style={{ marginBottom: "1.5rem", maxWidth: 420 }}>
        <label className="form-label" htmlFor="costDesign">
          Select Design
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

      {selectedDesignId && (
        <>
          <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
            <StatCard
              label="Total Dev Cost"
              value={summary ? `₹${summary.totalDevCost.toFixed(2)}` : "—"}
              accent
            />
            <StatCard label="Cost Entries" value={String(summary?.entryCount ?? 0)} />
            <StatCard
              label="Costing Complete"
              value={summary?.hasCosting ? "Yes" : "No"}
              trend={summary?.hasCosting ? "Ready for final approval" : "Add cost entries"}
            />
          </div>

          <div className="card" style={{ marginBottom: "1.5rem" }}>
            <span className="card-title">Add Cost Entry</span>
            <form onSubmit={handleAddCost} style={{ marginTop: "1rem" }}>
              <div className="form-grid form-grid--2">
                <div className="form-group">
                  <label className="form-label" htmlFor="costType">
                    Type
                  </label>
                  <select
                    id="costType"
                    className="form-select"
                    value={costType}
                    onChange={(e) => setCostType(e.target.value as typeof costType)}
                  >
                    <option value="TIME">Time</option>
                    <option value="MATERIAL">Material</option>
                    <option value="MACHINE">Machine</option>
                    <option value="CORRECTION">Correction Rework</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="costAmount">
                    Amount (₹) *
                  </label>
                  <input
                    id="costAmount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="costDesc">
                  Description
                </label>
                <input
                  id="costDesc"
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={addCost.isPending}>
                Add Entry
              </button>
            </form>
          </div>

          <QueryState
            isLoading={costsQuery.isLoading}
            isError={costsQuery.isError}
            error={costsQuery.error}
            onRetry={() => costsQuery.refetch()}
          >
            <div className="card">
              <DataTable
                columns={[
                  { key: "costType", header: "Type" },
                  { key: "description", header: "Description", render: (r) => r.description ?? "—" },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (r) => `₹${Number(r.amount).toFixed(2)}`,
                  },
                  { key: "enteredBy", header: "Entered By", render: (r) => r.enteredBy.name },
                  {
                    key: "enteredAtUtc",
                    header: "Date",
                    render: (r) => new Date(r.enteredAtUtc).toLocaleDateString(),
                  },
                ]}
                rows={costsQuery.data?.costs ?? []}
                getRowKey={(r) => r.id}
                emptyTitle="No cost entries"
                emptyDescription="Add development, material, machine, or correction costs above."
              />
              <p style={{ marginTop: "1rem" }}>
                <Link href={ROUTES.designs.detail(selectedDesignId)} className="data-table-link">
                  View design detail
                </Link>
              </p>
            </div>
          </QueryState>
        </>
      )}
    </div>
  );
}
