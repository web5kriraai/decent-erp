"use client";

import { useSession } from "next-auth/react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import {
  approvalsHubHrefForRole,
  getApprovalHubTabsForRole,
} from "@/lib/stage-approval-rbac";
import { useManagementWorkbench } from "@/hooks/use-workbench";
import { useConceptTargets } from "@/hooks/use-masters";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";

export function ManagementDashboard() {
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;
  const hubTabs = getApprovalHubTabsForRole(roleCode);
  const summaryQuery = useManagementWorkbench(true);
  const conceptTargetsQuery = useConceptTargets(true);

  const summary = summaryQuery.data;
  const attainment = conceptTargetsQuery.data?.attainment;
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const stageHref = approvalsHubHrefForRole(roleCode, "stage");

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Executive overview"
      actions={
        <AppButtonLink href={ROUTES.analytics.kpi} appVariant="secondary" size="sm">
          KPI dashboard
        </AppButtonLink>
      }
      isLoading={summaryQuery.isLoading}
      isError={summaryQuery.isError}
      error={summaryQuery.error}
      onRetry={() => {
        summaryQuery.refetch();
        conceptTargetsQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="Approved - production queue" value={summary?.approvedCount ?? 0} />
          <StatCard label="Released to production" value={summary?.releasedCount ?? 0} />
          <StatCard label="Live review pending" value={summary?.liveReviewPending ?? 0} />
          <StatCard label="Under development" value={summary?.underDevelopment ?? 0} />
          <StatCard
            label="Concept target"
            value={
              attainment
                ? `${attainment.createdCount}/${attainment.targetCount || "-"}`
                : "-"
            }
            trend={
              attainment
                ? `${attainment.percent}% · ${attainment.periodMonth}/${attainment.periodYear}`
                : undefined
            }
            tone="accent"
          />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Management decisions">
        <h2 className="workbench-section-title">Decision queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="Production readiness"
            href={ROUTES.production.release}
            linkLabel="Production desk"
            emptyMessage="No approved designs in production queue."
          >
            <p className="workbench-row-meta stack-section-sm">
              {summary?.approvedCount ?? 0} approved design(s) in the production workflow.
              {summary?.releasedCount
                ? ` ${summary.releasedCount} already released to shop floor.`
                : ""}
            </p>
            <AppButtonLink href={ROUTES.production.release} appVariant="secondary" size="sm">
              View production desk
            </AppButtonLink>
          </WorkbenchQueueCard>

          {hubTabs.stage ? (
            <WorkbenchQueueCard
              title="Live design review"
              href={stageHref}
              linkLabel="Approvals"
              emptyMessage="No released designs awaiting live review."
            >
              {!summary?.liveReviewTasks?.length ? (
                <WorkbenchEmpty message="Open Approvals → Stage after production release." />
              ) : (
                <ul className="detail-task-list">
                  {summary.liveReviewTasks.map((task) => (
                    <WorkbenchListItem
                      key={task.id.toString()}
                      primaryHref={ROUTES.work.taskDetail(task.id.toString())}
                      primaryLabel={task.design.ideaRef}
                      meta={task.design.collectionName}
                      detail={`${task.subProcess.name} · ${task.status.replace(/_/g, " ")}`}
                      trailing={<StatusBadge status={task.design.status} />}
                    />
                  ))}
                </ul>
              )}
            </WorkbenchQueueCard>
          ) : null}

          <WorkbenchQueueCard
            title="Portfolio in development"
            href={ROUTES.designs.list}
            linkLabel="All designs"
            emptyMessage="No active development."
          >
            <p className="workbench-row-meta">
              {summary?.underDevelopment ?? 0} design(s) actively moving through development
              stages before Design Head final approve.
            </p>
            <AppButtonLink href={ROUTES.designs.kanban} appVariant="ghost" size="sm">
              Open pipeline
            </AppButtonLink>
          </WorkbenchQueueCard>
        </div>
      </section>
    </WorkbenchShell>
  );
}
