"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { DataTable } from "@/components/DataTable";
import { QueryState } from "@/components/ui/QueryState";
import { StatusBadge } from "@/components/StatusBadge";
import { PermissionDenied } from "@/components/PermissionDenied";
import { FormTextField } from "@/components/ui/form-text-field";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import {
  canCompleteErpStage,
  canOperateErpModule,
  canStartErpStage,
  canViewErpChain,
  fieldsForErpModule,
  permissionRequiredForErpModule,
  validateCompleteErpStageInput,
} from "@/lib/erp-rbac";
import {
  useBackfillErpStages,
  useErpStageAction,
  useErpStageChains,
  type ErpStageChain,
  type ErpStageRow,
} from "@/hooks/use-production";
import { ERP_STAGE_LABELS } from "@/lib/services/erp-stage-constants";
import { formatPermissionLabel } from "@/lib/user-messages";

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
  const canView = canViewErpChain(permissions);
  const canBackfill = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const canOpenDesk = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const canOpenDesignSuccess = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const chainsQuery = useErpStageChains(canView);
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
  const [formError, setFormError] = useState<string | null>(null);

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

  const canStart =
    !!activeStage && canStartErpStage(permissions, activeStage.erpModule, activeStage.status);
  const canComplete =
    !!activeStage &&
    canCompleteErpStage(permissions, activeStage.erpModule, activeStage.status);
  const fields = canComplete && activeStage ? fieldsForErpModule(activeStage.erpModule) : null;
  const blockedPerm =
    activeStage && !canOperateErpModule(permissions, activeStage.erpModule)
      ? permissionRequiredForErpModule(activeStage.erpModule)
      : null;

  useEffect(() => {
    setFormError(null);
    setQty("100");
    setWastageQty("0");
    setAmount("0");
    setLotRef("");
    setInvoiceRef("");
    setRemark("");
    setMarginPercent("18");
  }, [activeStage?.id, activeStage?.status]);

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied
          message="This section is for people who can run Floor, Sales, or Accounts stages on the ERP Chain. Ask your admin if you need access."
        />
      </div>
    );
  }

  function submitComplete() {
    if (!activeStage || !fields) return;
    const payload = {
      qty: fields.qty ? Number(qty) : undefined,
      wastageQty: fields.wastageQty ? Number(wastageQty) : undefined,
      amount: fields.amount ? Number(amount) : undefined,
      lotRef: fields.lotRef ? lotRef.trim() || undefined : undefined,
      invoiceRef: fields.invoiceRef ? invoiceRef.trim() || undefined : undefined,
      remark: fields.remark ? remark.trim() || undefined : undefined,
      marginPercent: fields.marginPercent ? Number(marginPercent) : undefined,
    };
    const error = validateCompleteErpStageInput(activeStage.erpModule, payload);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    stageAction.mutate({
      stageId: stageId(activeStage),
      action: "complete",
      ...payload,
    });
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="ERP Chain"
        subtitle="Grey → Cutting → Embroidery → Garmenting → Finishing → Ready Stock → Sales → Sales Return → Accounts. Floor, Sales, and Accounts use separate permissions."
      />

      <AppCard title="Actions" className="stack-section">
        <div className="flex flex-wrap gap-2 items-center">
          {canBackfill ? (
            <AppButton
              type="button"
              appVariant="secondary"
              size="sm"
              disabled={backfill.isPending}
              onClick={() => backfill.mutate()}
            >
              Backfill stages for released designs
            </AppButton>
          ) : null}
          {canOpenDesk ? (
            <Link href={ROUTES.production.release} className="data-table-link text-sm">
              Open Production Desk
            </Link>
          ) : null}
          {canOpenDesignSuccess ? (
            <Link href={ROUTES.analytics.reportsDesignSuccess} className="data-table-link text-sm">
              Design Success report
            </Link>
          ) : null}
        </div>
        <p className="text-muted-inline mt-3 mb-0 text-xs">
          Your access:{" "}
          {[
            permissions.includes(PERMISSIONS.ERP_FLOOR_OPERATE) && "Floor",
            permissions.includes(PERMISSIONS.ERP_SALES_OPERATE) && "Sales",
            permissions.includes(PERMISSIONS.ERP_ACCOUNTS_OPERATE) && "Accounts",
            permissions.includes(PERMISSIONS.PRODUCTION_RELEASE) && "Release/Backfill",
          ]
            .filter(Boolean)
            .join(" · ") || "View only"}
        </p>
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
                  row.currentModule
                    ? stageLabel(row.currentModule)
                    : row.completedCount === 9
                      ? "Done"
                      : "—",
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
            emptyDescription={
              canBackfill
                ? "Release a design from Production Desk, or run Backfill for already-released designs."
                : "No released designs have ERP stages yet. Ask Production to release or backfill."
            }
          />
        </AppCard>
      </QueryState>

      {selected ? (
        <AppCard
          title={`${selected.ideaRef} — ${selected.designNumber}`}
          className="stack-section"
        >
          <ol className="mb-4 m-0 list-none space-y-2 p-0">
            {selected.stages.map((stage) => {
              const allowed = canOperateErpModule(permissions, stage.erpModule);
              return (
                <li
                  key={stageId(stage)}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 text-sm"
                >
                  <span>
                    <strong>
                      {stage.sequence}. {stageLabel(stage.erpModule)}
                    </strong>
                    {stage.qty ? ` · qty ${stage.qty}` : ""}
                    {stage.lotRef ? ` · lot ${stage.lotRef}` : ""}
                    {stage.invoiceRef ? ` · inv ${stage.invoiceRef}` : ""}
                    {!allowed ? (
                      <span className="text-muted-foreground"> · other role</span>
                    ) : null}
                  </span>
                  <StatusBadge status={stage.status} />
                </li>
              );
            })}
          </ol>

          {activeStage ? (
            <div className="grid gap-3 md:grid-cols-2">
              {blockedPerm ? (
                <p className="md:col-span-2 text-sm text-muted-foreground m-0">
                  Waiting on {stageLabel(activeStage.erpModule)} — your role cannot operate this
                  stage ({formatPermissionLabel(blockedPerm)}).
                </p>
              ) : null}

              {canStart ? (
                <div className="md:col-span-2">
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
                </div>
              ) : null}

              {canComplete && fields ? (
                <>
                  {fields.qty ? (
                    <FormTextField
                      id="erp-qty"
                      label="Qty"
                      type="number"
                      min={fields.qtyMin}
                      required={fields.qtyRequired}
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                    />
                  ) : null}
                  {fields.wastageQty ? (
                    <FormTextField
                      id="erp-wastage"
                      label="Wastage qty"
                      type="number"
                      min={0}
                      value={wastageQty}
                      onChange={(e) => setWastageQty(e.target.value)}
                    />
                  ) : null}
                  {fields.amount ? (
                    <FormTextField
                      id="erp-amount"
                      label="Amount / value"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  ) : null}
                  {fields.marginPercent ? (
                    <FormTextField
                      id="erp-margin"
                      label="Margin %"
                      type="number"
                      min={-100}
                      max={100}
                      step="0.01"
                      required
                      value={marginPercent}
                      onChange={(e) => setMarginPercent(e.target.value)}
                    />
                  ) : null}
                  {fields.lotRef ? (
                    <FormTextField
                      id="erp-lot"
                      label="Lot / shade ref"
                      value={lotRef}
                      onChange={(e) => setLotRef(e.target.value)}
                    />
                  ) : null}
                  {fields.invoiceRef ? (
                    <FormTextField
                      id="erp-invoice"
                      label="Invoice / CN ref"
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                    />
                  ) : null}
                  {fields.remark ? (
                    <FormTextField
                      id="erp-remark"
                      label="Remark"
                      fieldClassName="md:col-span-2"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                    />
                  ) : null}
                  {formError ? (
                    <p className="md:col-span-2 text-sm text-destructive m-0">{formError}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 md:col-span-2">
                    <AppButton
                      type="button"
                      size="sm"
                      disabled={stageAction.isPending}
                      onClick={submitComplete}
                    >
                      Complete {stageLabel(activeStage.erpModule)}
                    </AppButton>
                  </div>
                </>
              ) : null}

              {!blockedPerm && !canStart && !canComplete ? (
                <p className="md:col-span-2 text-sm text-muted-foreground m-0">
                  No actions available for the current stage state.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground m-0">
              All 9 stages completed for this design.
            </p>
          )}
        </AppCard>
      ) : null}
    </div>
  );
}
