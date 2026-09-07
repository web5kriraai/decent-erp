"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppButton } from "@/components/ui/AppButton";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import {
  IconCheckCircle2,
  IconClock3,
  IconErpChain,
  IconAlertTriangle,
} from "@/components/icons";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import {
  canOperateErpModule,
  canViewErpChain,
} from "@/lib/erp-rbac";
import {
  useBackfillErpStages,
  useErpStageAction,
  useErpStageChains,
  type ErpStageChain,
} from "@/hooks/use-production";
import { ERP_STAGE_LABELS } from "@/lib/services/erp-stage-constants";
import { ErpStageOperator } from "@/features/production/ErpStageOperator";
import { cn } from "@/lib/utils";

function stageLabel(module: string) {
  return (
    ERP_STAGE_LABELS[module as keyof typeof ERP_STAGE_LABELS] ?? module.replaceAll("_", " ")
  );
}

function ErpChainMetric({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "neutral" | "info" | "warn" | "success";
}) {
  return (
    <div className={cn("erp-chain-metric", tone !== "neutral" && `erp-chain-metric--${tone}`)}>
      <span className="erp-chain-metric-icon" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="erp-chain-metric-label">{label}</p>
        <p className="erp-chain-metric-value">{value}</p>
      </div>
    </div>
  );
}

export function ErpChainView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canView = canViewErpChain(permissions);
  const canBackfill = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const canOpenDesk = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const chainsQuery = useErpStageChains(canView);
  const backfill = useBackfillErpStages();
  const stageAction = useErpStageAction();
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);

  const chains = chainsQuery.data ?? [];

  const selected = useMemo(
    () => chains.find((c) => c.designId === selectedDesignId) ?? null,
    [chains, selectedDesignId],
  );

  useEffect(() => {
    if (!selectedDesignId && chains.length > 0) {
      setSelectedDesignId(chains[0].designId);
    }
  }, [chains, selectedDesignId]);

  const metrics = useMemo(() => {
    let inProgress = 0;
    let waitingOnYou = 0;
    let blockedByRole = 0;
    let done = 0;
    for (const chain of chains) {
      if (chain.completedCount === 9) {
        done += 1;
        continue;
      }
      const active =
        chain.stages.find((s) => s.status === "IN_PROGRESS" || s.status === "READY") ?? null;
      if (!active) continue;
      if (active.status === "IN_PROGRESS") inProgress += 1;
      if (canOperateErpModule(permissions, active.erpModule)) {
        waitingOnYou += 1;
      } else {
        blockedByRole += 1;
      }
    }
    return { inProgress, waitingOnYou, blockedByRole, done };
  }, [chains, permissions]);

  if (!canView) {
    return (
      <div className="page-shell">
        <PermissionDenied message="ERP Chain requires Floor, Sales, or Accounts access." />
      </div>
    );
  }

  return (
    <div className="page-shell erp-chain-page">
      <PageHeader
        title="ERP Chain"
        actions={
          <div className="erp-chain-header-actions">
            {canOpenDesk ? (
              <Link href={ROUTES.production.release} className="data-table-link text-sm">
                Production Desk
              </Link>
            ) : null}
            {canBackfill ? (
              <AppButton
                type="button"
                appVariant="outline"
                size="sm"
                disabled={backfill.isPending}
                onClick={() => backfill.mutate()}
              >
                Backfill
              </AppButton>
            ) : null}
          </div>
        }
      />

      <div className="erp-chain-metric-row" role="group" aria-label="ERP chain summary">
        <ErpChainMetric
          label="In progress"
          value={metrics.inProgress}
          tone="info"
          icon={<IconClock3 size={16} />}
        />
        <ErpChainMetric
          label="Waiting on you"
          value={metrics.waitingOnYou}
          tone="warn"
          icon={<IconErpChain size={16} />}
        />
        <ErpChainMetric
          label="Other role"
          value={metrics.blockedByRole}
          tone="neutral"
          icon={<IconAlertTriangle size={16} />}
        />
        <ErpChainMetric
          label="Done"
          value={metrics.done}
          tone="success"
          icon={<IconCheckCircle2 size={16} />}
        />
      </div>

      <QueryState
        isLoading={chainsQuery.isLoading}
        isError={chainsQuery.isError}
        error={chainsQuery.error}
        onRetry={() => chainsQuery.refetch()}
        skeletonVariant="table"
      >
        <div className="erp-chain-board">
          <div className="erp-chain-queue" role="list" aria-label="Designs in ERP chain">
            {chains.length === 0 ? (
              <p className="erp-chain-queue-empty">No ERP chains yet</p>
            ) : (
              chains.map((row: ErpStageChain) => {
                const active = row.designId === selectedDesignId;
                const done = row.completedCount === 9;
                return (
                  <button
                    key={row.designId}
                    type="button"
                    role="listitem"
                    className={cn(
                      "erp-chain-row",
                      active && "erp-chain-row--active",
                      done && "erp-chain-row--done",
                    )}
                    onClick={() => setSelectedDesignId(row.designId)}
                  >
                    <span className="erp-chain-row-ref">{row.ideaRef}</span>
                    <p className="erp-chain-row-meta">
                      {row.collectionName} · {row.completedCount}/9
                      {row.currentModule
                        ? ` · ${stageLabel(row.currentModule)}`
                        : done
                          ? " · Done"
                          : ""}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className="erp-chain-work-panel">
            {selected ? (
              <ErpStageOperator
                chain={selected}
                permissions={permissions}
                isPending={stageAction.isPending}
                onStart={(stageId) =>
                  stageAction.mutate({ stageId, action: "start" })
                }
                onComplete={(stageId, payload) =>
                  stageAction.mutate({ stageId, action: "complete", ...payload })
                }
              />
            ) : (
              <p className="erp-chain-queue-empty">Select a design</p>
            )}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
