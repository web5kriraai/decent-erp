"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import {
  useBackfillErpStages,
  useErpStageAction,
  useErpStageChains,
  type ErpStageChain,
  type ErpStageRow,
} from "@/hooks/use-production";
import { ERP_STAGE_LABELS } from "@/lib/services/erp-stage-constants";

function stageLabel(module: string) {
  return (
    ERP_STAGE_LABELS[module as keyof typeof ERP_STAGE_LABELS] ?? module.replaceAll("_", " ")
  );
}

function stageId(row: ErpStageRow) {
  return String(row.id);
}

export function ErpChainView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canOperate = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const chainsQuery = useErpStageChains(canOperate);
  const backfill = useBackfillErpStages();
  const stageAction = useErpStageAction();
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [qty, setQty] = useState("100");
  const [wastageQty, setWastageQty] = useState("0");
  const [amount, setAmount] = useState("0");
  const [lotRef, setLotRef] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [remark, setRemark] = useState("");
  const [marginPercent, setMarginPercent] = useState("18");

  const selected = useMemo(
    () => (chainsQuery.data ?? []).find((c) => c.designId === selectedDesignId) ?? null,
    [chainsQuery.data, selectedDesignId],
  );

  const activeStage = useMemo(() => {
    if (!selected) return null;
    return (
      selected.stages.find((s) => s.status === "IN_PROGRESS" || s.status === "READY") ?? null
    );
  }, [selected]);

  if (!canOperate) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.PRODUCTION_RELEASE} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="ERP Chain"
        subtitle="Operate Grey → Cutting → Embroidery → Garmenting → Finishing → Ready Stock → Sales → Sales Return → Accounts in-app. External partner sync still runs from Production Desk."
      />

      <AppCard title="Actions" className="stack-section">
        <div className="flex flex-wrap gap-2">
          <AppButton
            type="button"
            appVariant="secondary"
            size="sm"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate()}
          >
            Backfill stages for released designs
          </AppButton>
          <Link href={ROUTES.production.release} className="data-table-link text-sm self-center">
            Open Production Desk
          </Link>
        </div>
      </AppCard>

      <QueryState
        isLoading={chainsQuery.isLoading}
        isError={chainsQuery.isError}
        error={chainsQuery.error}
        onRetry={() => chainsQuery.refetch()}
        skeletonVariant="table"
      >
        <AppCard title="Released designs in ERP chain" className="stack-section">
          <DataTable
            columns={[
              {
                key: "design",
                header: "Design",
                render: (row: ErpStageChain) => (
                  <button
                    type="button"
                    className="data-table-link text-left"
                    onClick={() => setSelectedDesignId(row.designId)}
                  >
                    {row.ideaRef}
                  </button>
                ),
              },
              { key: "designNumber", header: "Design No." },
              { key: "collectionName", header: "Collection" },
              {
                key: "progress",
                header: "Progress",
                render: (row) => `${row.completedCount}/9`,
              },
              {
                key: "current",
                header: "Current",
                render: (row) =>
                  row.currentModule ? stageLabel(row.currentModule) : row.completedCount === 9 ? "Done" : "—",
              },
              {
                key: "status",
                header: "Design",
                render: (row) => <StatusBadge status={row.designStatus} />,
              },
            ]}
            rows={chainsQuery.data ?? []}
            getRowKey={(r) => r.designId}
            emptyTitle="No ERP stage chains yet"
            emptyDescription="Release a design from Production Desk, or run Backfill for already-released designs."
          />
        </AppCard>
      </QueryState>

      {selected ? (
        <AppCard
          title={`${selected.ideaRef} — ${selected.designNumber}`}
          className="stack-section"
        >
          <ol className="mb-4 m-0 list-none space-y-2 p-0">
            {selected.stages.map((stage) => (
              <li
                key={stageId(stage)}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 text-sm"
              >
                <span>
                  <strong>{stage.sequence}. {stageLabel(stage.erpModule)}</strong>
                  {stage.qty ? ` · qty ${stage.qty}` : ""}
                  {stage.lotRef ? ` · lot ${stage.lotRef}` : ""}
                  {stage.invoiceRef ? ` · inv ${stage.invoiceRef}` : ""}
                </span>
                <StatusBadge status={stage.status} />
              </li>
            ))}
          </ol>

          {activeStage ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                Qty
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Wastage qty
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={wastageQty}
                  onChange={(e) => setWastageQty(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Amount / value
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Margin % (Accounts)
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Lot / shade ref
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={lotRef}
                  onChange={(e) => setLotRef(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Invoice / CN ref
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                />
              </label>
              <label className="text-sm md:col-span-2">
                Remark
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                {activeStage.status === "READY" ? (
                  <AppButton
                    type="button"
                    size="sm"
                    disabled={stageAction.isPending}
                    onClick={() =>
                      stageAction.mutate({
                        stageId: stageId(activeStage),
                        action: "start",
                      })
                    }
                  >
                    Start {stageLabel(activeStage.erpModule)}
                  </AppButton>
                ) : null}
                <AppButton
                  type="button"
                  size="sm"
                  disabled={stageAction.isPending}
                  onClick={() =>
                    stageAction.mutate({
                      stageId: stageId(activeStage),
                      action: "complete",
                      qty: Number(qty) || 0,
                      wastageQty: Number(wastageQty) || 0,
                      amount: Number(amount) || 0,
                      lotRef: lotRef || undefined,
                      invoiceRef: invoiceRef || undefined,
                      remark: remark || undefined,
                      marginPercent: Number(marginPercent) || undefined,
                    })
                  }
                >
                  Complete {stageLabel(activeStage.erpModule)}
                </AppButton>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground m-0">
              All 9 stages completed for this design. Design Success metrics were updated from Ready Stock / Sales / Sales Return / Accounts.
            </p>
          )}
        </AppCard>
      ) : null}
    </div>
  );
}
