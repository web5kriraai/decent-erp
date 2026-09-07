"use client";

import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { FormTextField } from "@/components/ui/form-text-field";
import { StatusBadge } from "@/components/StatusBadge";
import {
  canCompleteErpStage,
  canOperateErpModule,
  canStartErpStage,
  ERP_FLOOR_MODULES,
  fieldsForErpModule,
  isErpFloorModule,
  permissionRequiredForErpModule,
  validateCompleteErpStageInput,
} from "@/lib/erp-rbac";
import { ERP_STAGE_LABELS } from "@/lib/services/erp-stage-constants";
import { formatPermissionLabel } from "@/lib/user-messages";
import { cn } from "@/lib/utils";
import type { ErpStageChain, ErpStageRow } from "@/hooks/use-production";

function stageLabel(module: string) {
  return (
    ERP_STAGE_LABELS[module as keyof typeof ERP_STAGE_LABELS] ?? module.replaceAll("_", " ")
  );
}

function stageId(row: ErpStageRow) {
  return String(row.id);
}

export function floorProgressFromChain(chain: ErpStageChain | null | undefined): {
  completed: number;
  total: number;
  ok: boolean;
} {
  const total = ERP_FLOOR_MODULES.length;
  const stages = chain && Array.isArray(chain.stages) ? chain.stages : null;
  if (!stages) return { completed: 0, total, ok: false };
  const completed = stages.filter(
    (s) => isErpFloorModule(s.erpModule) && s.status === "COMPLETED",
  ).length;
  return { completed, total, ok: completed === total };
}

type ErpStageOperatorProps = {
  chain: ErpStageChain;
  permissions: string[];
  isPending?: boolean;
  onStart: (stageId: string) => void;
  onComplete: (
    stageId: string,
    payload: {
      qty?: number;
      wastageQty?: number;
      amount?: number;
      lotRef?: string;
      invoiceRef?: string;
      remark?: string;
      marginPercent?: number;
    },
  ) => void;
  /** When true, emphasize Floor progress chip (PROD_RELEASE task). */
  showFloorChip?: boolean;
  className?: string;
};

export function ErpStageOperator({
  chain,
  permissions,
  isPending = false,
  onStart,
  onComplete,
  showFloorChip = false,
  className,
}: ErpStageOperatorProps) {
  const [qty, setQty] = useState("100");
  const [wastageQty, setWastageQty] = useState("0");
  const [amount, setAmount] = useState("0");
  const [lotRef, setLotRef] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [remark, setRemark] = useState("");
  const [marginPercent, setMarginPercent] = useState("18");
  const [formError, setFormError] = useState<string | null>(null);

  const stages = Array.isArray(chain.stages) ? chain.stages : [];
  const floor = floorProgressFromChain(chain);

  const activeStage = useMemo(() => {
    return stages.find((s) => s.status === "IN_PROGRESS" || s.status === "READY") ?? null;
  }, [stages]);

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
    onComplete(stageId(activeStage), payload);
  }

  return (
    <div className={cn("erp-chain-operator", className)}>
      <div className="erp-chain-operator-head">
        <div className="min-w-0">
          <p className="erp-chain-operator-title">
            {chain.ideaRef}
            <span className="erp-chain-operator-muted"> · {chain.designNumber}</span>
          </p>
          <p className="erp-chain-operator-meta">{chain.collectionName}</p>
        </div>
        <div className="erp-chain-operator-badges">
          {showFloorChip ? (
            <span
              className={cn(
                "erp-chain-floor-chip",
                floor.ok && "erp-chain-floor-chip--ok",
              )}
            >
              Floor {floor.completed}/{floor.total}
            </span>
          ) : null}
          <StatusBadge status={chain.designStatus} />
        </div>
      </div>

      <ol className="erp-chain-rail" aria-label="ERP stages">
        {stages.map((stage, index) => {
          const done = stage.status === "COMPLETED";
          const active =
            stage.status === "IN_PROGRESS" ||
            stage.status === "READY" ||
            (!!activeStage && stageId(stage) === stageId(activeStage));
          const allowed = canOperateErpModule(permissions, stage.erpModule);
          return (
            <li key={stageId(stage)} className="erp-chain-rail-item">
              {index > 0 ? (
                <span
                  className={cn(
                    "erp-chain-rail-connector",
                    done || active ? "erp-chain-rail-connector--lit" : null,
                  )}
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  "erp-chain-rail-step",
                  done && "erp-chain-rail-step--done",
                  active && !done && "erp-chain-rail-step--active",
                  !allowed && "erp-chain-rail-step--locked",
                )}
                title={stageLabel(stage.erpModule)}
              >
                <span className="erp-chain-rail-index" aria-hidden>
                  {stage.sequence}
                </span>
                <span className="erp-chain-rail-label">{stageLabel(stage.erpModule)}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {activeStage ? (
        <div className="erp-chain-work">
          <div className="erp-chain-work-head">
            <p className="erp-chain-work-title">{stageLabel(activeStage.erpModule)}</p>
            <StatusBadge status={activeStage.status} />
          </div>

          {blockedPerm ? (
            <p className="erp-chain-work-blocked m-0">
              Waiting on {formatPermissionLabel(blockedPerm)}
            </p>
          ) : null}

          {canStart ? (
            <AppButton
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => onStart(stageId(activeStage))}
            >
              Start {stageLabel(activeStage.erpModule)}
            </AppButton>
          ) : null}

          {canComplete && fields ? (
            <div className="erp-chain-form">
              {fields.qty ? (
                <FormTextField
                  id={`erp-qty-${stageId(activeStage)}`}
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
                  id={`erp-wastage-${stageId(activeStage)}`}
                  label="Wastage qty"
                  type="number"
                  min={0}
                  value={wastageQty}
                  onChange={(e) => setWastageQty(e.target.value)}
                />
              ) : null}
              {fields.amount ? (
                <FormTextField
                  id={`erp-amount-${stageId(activeStage)}`}
                  label="Amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              ) : null}
              {fields.marginPercent ? (
                <FormTextField
                  id={`erp-margin-${stageId(activeStage)}`}
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
                  id={`erp-lot-${stageId(activeStage)}`}
                  label="Lot / shade"
                  value={lotRef}
                  onChange={(e) => setLotRef(e.target.value)}
                />
              ) : null}
              {fields.invoiceRef ? (
                <FormTextField
                  id={`erp-invoice-${stageId(activeStage)}`}
                  label="Invoice / CN"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                />
              ) : null}
              {fields.remark ? (
                <FormTextField
                  id={`erp-remark-${stageId(activeStage)}`}
                  label="Remark"
                  fieldClassName="erp-chain-form-span"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              ) : null}
              {formError ? (
                <p className="erp-chain-form-error erp-chain-form-span m-0">{formError}</p>
              ) : null}
              <div className="erp-chain-form-span">
                <AppButton
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={submitComplete}
                >
                  Complete {stageLabel(activeStage.erpModule)}
                </AppButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="erp-chain-work-done m-0">All stages complete</p>
      )}
    </div>
  );
}
