"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextField } from "@/components/ui/form-text-field";
import { ModalForm, ModalFormGrid } from "@/components/ui/Modal";
import { useAddCostEntry, useDesignCosts } from "@/hooks/use-costing";
import { PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";
import type { DesignSummary } from "@/lib/types/api";

function inr(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <AppCard title="Estimated">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Employee</dt>
              <dd className="font-medium">{inr(employeeEst || null)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Material</dt>
              <dd className="font-medium">{inr(materialEst || null)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Machine</dt>
              <dd className="font-medium">{inr(machineEst || null)}</dd>
            </div>
            {estimated != null ? (
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <dt className="text-muted-foreground">Baseline</dt>
                <dd className="font-semibold">{inr(estimated)}</dd>
              </div>
            ) : null}
          </dl>
        </AppCard>
        <AppCard title="Actual">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total Cost</dt>
              <dd className="font-medium">{inr(total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Correction Cost</dt>
              <dd className="font-medium">{inr(correctionCost)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Margin</dt>
              <dd
                className={`font-semibold ${
                  margin != null && margin >= 0 ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {margin != null ? `${margin}%` : "—"}
              </dd>
            </div>
          </dl>
        </AppCard>
      </div>

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
