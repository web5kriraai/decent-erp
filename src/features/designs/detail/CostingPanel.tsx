"use client";

import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { ModalForm, ModalFormGrid } from "@/components/ui/Modal";
import { useAddCostEntry, useDesignCosts } from "@/hooks/use-costing";
import { PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";
import type { DesignCostRecord, DesignSummary } from "@/lib/types/api";

function inr(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "Not entered";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const COST_TYPE_LABEL: Record<string, string> = {
  TIME: "Employee",
  MATERIAL: "Material",
  MACHINE: "Machine",
  CORRECTION: "Correction",
};

export function CostingPanel({ design }: { design: DesignSummary }) {
  const { data: session } = useSession();
  const canCost = (session?.user?.permissions ?? []).includes(PERMISSIONS.COST_VIEW);
  const costsQuery = useDesignCosts(design.id, true);
  const addCost = useAddCostEntry(design.id);
  const [open, setOpen] = useState(false);
  const [costType, setCostType] = useState<"TIME" | "MATERIAL" | "MACHINE" | "CORRECTION">(
    "TIME",
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const summary = costsQuery.data?.summary;
  const entries = costsQuery.data?.costs ?? [];
  const hasEntries = (summary?.entryCount ?? entries.length) > 0;
  const byType = summary?.byType ?? {};
  const byCategory = summary?.byCategory ?? {};
  const employeeEst = (byCategory.SALARY ?? 0) || (byType.TIME ?? 0) || 0;
  const materialCat =
    (byCategory.FABRIC ?? 0) + (byCategory.EMBROIDERY ?? 0) + (byCategory.STITCHING ?? 0);
  const materialEst = materialCat || (byType.MATERIAL ?? 0) || 0;
  const machineEst = byType.MACHINE ?? 0;
  const estimated =
    summary?.estimatedCost ??
    design.detailMeta?.costSummary.estimatedCost ??
    design.estimatedCost ??
    null;
  const total =
    summary?.totalDevCost ?? design.detailMeta?.costSummary.totalDevCost ?? 0;
  const correctionCost =
    summary?.byType?.CORRECTION ??
    design.detailMeta?.costSummary.correctionCost ??
    0;
  const margin =
    summary?.marginPercent ?? design.detailMeta?.costSummary.marginPercent;

  async function handleAdd() {
    const n = Number(amount);
    if (!n || n <= 0) return;
    await addCost.mutateAsync({
      costType,
      amount: n,
      description: description.trim() || undefined,
      costCategory: costType === "TIME" ? "SALARY" : undefined,
    });
    setOpen(false);
    setAmount("");
    setDescription("");
  }

  const money = (n: number) => (hasEntries && n > 0 ? inr(n) : "Not entered");

  return (
    <div className="space-y-4">
      <AppCard
        title="Development cost"
        description="Money spent to develop this design: employee time, cloth and trims, machine time, and extra cost when a sample is corrected. Margin compares that total with the baseline estimate."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="m-0 mb-2 text-sm font-semibold text-foreground">Estimated</p>
            <dl className="design-detail-facts">
              <div>
                <dt>Employee</dt>
                <dd>{money(employeeEst)}</dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{money(materialEst)}</dd>
              </div>
              <div>
                <dt>Machine</dt>
                <dd>{money(machineEst)}</dd>
              </div>
              <div>
                <dt>Baseline</dt>
                <dd>{estimated != null ? inr(estimated) : "Not set"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="m-0 mb-2 text-sm font-semibold text-foreground">Actual</p>
            <dl className="design-detail-facts">
              <div>
                <dt>Total cost</dt>
                <dd>{hasEntries ? inr(total) : "Not entered"}</dd>
              </div>
              <div>
                <dt>Correction cost</dt>
                <dd>{hasEntries && correctionCost > 0 ? inr(correctionCost) : "Not entered"}</dd>
              </div>
              <div>
                <dt>Margin</dt>
                <dd>{margin != null ? `${margin}%` : "Not entered"}</dd>
              </div>
            </dl>
          </div>
        </div>
        {!hasEntries ? (
          <p className="m-0 mt-3 text-sm text-muted-foreground">
            Nothing has been costed yet. Figures appear when work is logged, or when the costing team adds an entry.
          </p>
        ) : null}
      </AppCard>

      {hasEntries ? (
        <AppCard title="Cost entries" flush>
          <DataTable<DesignCostRecord & Record<string, unknown>>
            flush
            columns={[
              {
                key: "costType",
                header: "Type",
                render: (row) => COST_TYPE_LABEL[row.costType] ?? row.costType,
              },
              {
                key: "description",
                header: "Note",
                render: (row) => row.description?.trim() || "-",
              },
              {
                key: "amount",
                header: "Amount",
                align: "right",
                render: (row) => inr(row.amount),
              },
              {
                key: "enteredBy",
                header: "Entered by",
                render: (row) => row.enteredBy?.name ?? "-",
              },
            ]}
            rows={entries as (DesignCostRecord & Record<string, unknown>)[]}
            getRowKey={(row) => row.id}
            emptyTitle="No cost entries"
          />
        </AppCard>
      ) : null}

      {canCost && !open ? (
        <AppButton type="button" appVariant="primary" size="sm" onClick={() => setOpen(true)}>
          Add Cost Entry
        </AppButton>
      ) : null}

      {canCost && open ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
          <h3 className="text-sm font-semibold">Add Cost Entry</h3>
          <ModalForm className="gap-3">
            <ModalFormGrid>
              <FormSelect
                id="costType"
                label="Cost Type"
                value={costType}
                onValueChange={(v) => setCostType((v as typeof costType) || "TIME")}
                options={[
                  { value: "TIME", label: "Employee / Time" },
                  { value: "MATERIAL", label: "Material" },
                  { value: "MACHINE", label: "Machine" },
                  { value: "CORRECTION", label: "Correction" },
                ]}
              />
              <FormTextField
                id="costAmount"
                label="Amount (₹)"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </ModalFormGrid>
            <FormTextField
              id="costDesc"
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </ModalForm>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AppButton type="button" appVariant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              type="button"
              appVariant="primary"
              size="sm"
              disabled={addCost.isPending}
              onClick={() => void handleAdd()}
            >
              {addCost.isPending ? "Saving…" : "Save"}
            </AppButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
