"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { QueryState } from "@/components/ui/QueryState";
import {
  useApprovedDesigns,
  useEnsureProductionLadder,
  useErpIntegrationStatus,
  useMarkDesignLive,
  useProductionHandoffs,
  useReleasedDesigns,
  useRetryHandoffSync,
  useSyncDesignHandoffs,
} from "@/hooks/use-production";
import {
  canEnsureProductionLadder,
  canRoleMarkDesignLive,
} from "@/lib/action-availability";
import { canViewErpChain } from "@/lib/erp-rbac";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { classifyProductionDeskRow } from "@/lib/services/production-desk-snapshot";
import { ProductionDeskMetrics } from "@/features/production/ProductionDeskMetrics";
import { ProductionDeskTools } from "@/features/production/ProductionDeskTools";
import {
  ProductionErpHandoffsSection,
  ProductionErpModePill,
} from "@/features/production/ProductionErpStatus";
import { ProductionGoLiveSection } from "@/features/production/ProductionGoLiveSection";
import { ProductionPipelineBoard } from "@/features/production/ProductionPipelineBoard";

export function ProductionReleaseView() {
  const { data: session, status: sessionStatus } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const roleCode = session?.user?.roleCode;
  const employeeId = session?.user?.employeeId;

  const canRelease = permissions.includes(PERMISSIONS.PRODUCTION_RELEASE);
  const canExecuteTasks = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const canMarkLive = canRoleMarkDesignLive(roleCode);
  const canEnsureLadder = canEnsureProductionLadder(roleCode, permissions);
  const showErpOps = canViewErpChain(permissions);

  const designsQuery = useApprovedDesigns(canRelease);
  const releasedQuery = useReleasedDesigns(canRelease && canMarkLive);
  const handoffsQuery = useProductionHandoffs(canRelease && showErpOps);
  const erpStatusQuery = useErpIntegrationStatus(canRelease);
  const markLive = useMarkDesignLive();
  const retrySync = useRetryHandoffSync();
  const syncDesignHandoffs = useSyncDesignHandoffs();
  const ensureLadder = useEnsureProductionLadder();

  const designs = designsQuery.data ?? [];
  const released = releasedQuery.data ?? [];
  const handoffs = handoffsQuery.data ?? [];

  const metrics = useMemo(() => {
    const counts = {
      blocked: 0,
      handoff: 0,
      instruction: 0,
      ready: 0,
      missing_ladder: 0,
    };
    for (const row of designs) {
      const bucket = classifyProductionDeskRow({
        releaseReady: row.releaseReady,
        nextAction: row.nextAction,
        stages: row.ladderStages ?? [],
      });
      counts[bucket] += 1;
    }
    return counts;
  }, [designs]);

  if (sessionStatus === "loading") {
    return (
      <div className="page-shell page-shell--wide production-desk-page">
        <PageHeader title="Production Desk" subtitle="Loading…" />
        <QueryState isLoading isError={false} error={null} skeletonVariant="table">
          {null}
        </QueryState>
      </div>
    );
  }

  if (!canRelease) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.PRODUCTION_RELEASE} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide production-desk-page">
      <PageHeader
        title="Production Desk"
        subtitle="Track handoff → instruction → release. Complete steps on My Tasks."
        actions={
          <div className="production-desk-header-actions">
            <ProductionErpModePill
              status={erpStatusQuery.data}
              showErpChainLink={showErpOps}
            />
            {canExecuteTasks ? (
              <AppButtonLink href={ROUTES.work.tasks} appVariant="primary" size="sm">
                Open My Tasks
              </AppButtonLink>
            ) : null}
          </div>
        }
      />

      <ProductionDeskMetrics
        blocked={metrics.blocked + metrics.missing_ladder}
        handoff={metrics.handoff}
        instruction={metrics.instruction}
        ready={metrics.ready}
        awaitingLive={released.length}
        showAwaitingLive={canMarkLive}
      />

      <QueryState
        isLoading={designsQuery.isLoading}
        isError={designsQuery.isError}
        error={designsQuery.error}
        onRetry={() => designsQuery.refetch()}
        skeletonVariant="table"
      >
        <ProductionPipelineBoard
          designs={designs}
          roleCode={roleCode}
          permissions={permissions}
          employeeId={employeeId}
        />
      </QueryState>

      {canMarkLive ? (
        <QueryState
          isLoading={releasedQuery.isLoading}
          isError={releasedQuery.isError}
          error={releasedQuery.error}
          onRetry={() => releasedQuery.refetch()}
          skeletonVariant="table"
        >
          <ProductionGoLiveSection
            designs={released}
            roleCode={roleCode}
            permissions={permissions}
            markLivePending={markLive.isPending}
            onMarkLive={(id) => markLive.mutate(id)}
          />
        </QueryState>
      ) : null}

      {showErpOps ? (
        <QueryState
          isLoading={handoffsQuery.isLoading}
          isError={handoffsQuery.isError}
          error={handoffsQuery.error}
          onRetry={() => handoffsQuery.refetch()}
          skeletonVariant="table"
        >
          <ProductionErpHandoffsSection
            handoffs={handoffs}
            syncPending={syncDesignHandoffs.isPending}
            retryPending={retrySync.isPending}
            onSyncLatest={(designId) => syncDesignHandoffs.mutate(designId)}
            onRetry={(id) => retrySync.mutate(id)}
          />
        </QueryState>
      ) : null}

      {canEnsureLadder ? (
        <ProductionDeskTools
          ensurePending={ensureLadder.isPending}
          onEnsureLadder={() => ensureLadder.mutate(undefined)}
        />
      ) : null}
    </div>
  );
}
