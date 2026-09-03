"use client";

import { useSession } from "next-auth/react";
import { AppButtonLink } from "@/components/ui/AppButton";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useManagementWorkbench } from "@/hooks/use-workbench";
import { usePendingApprovals } from "@/hooks/use-approvals";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";

export function ManagementDashboard() {
  const { data: session } = useSession();
  const summaryQuery = useManagementWorkbench(true);
  const approvalsQuery = usePendingApprovals(true);

  const summary = summaryQuery.data;
  const approvals = approvalsQuery.data ?? [];
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const highPriority = summary?.recentApprovalQueue.filter(
    (d) => d.priority === "HIGH" || d.priority === "URGENT",
  );

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Executive overview"
      subtitle="Final decisions, production readiness, and portfolio health"
      actions={
        <AppButtonLink href={ROUTES.analytics.kpi} appVariant="secondary" size="sm">
          KPI dashboard
        </AppButtonLink>
      }
      isLoading={summaryQuery.isLoading || approvalsQuery.isLoading}
      isError={summaryQuery.isError || approvalsQuery.isError}
      error={summaryQuery.error ?? approvalsQuery.error}
      onRetry={() => {
        summaryQuery.refetch();
        approvalsQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="Awaiting final approval" value={summary?.approvalPending ?? 0} />
          <StatCard label="High priority decisions" value={summary?.highPriorityPending ?? 0} />
          <StatCard
            label="Stuck in approval (30d+)"
            value={summary?.blockedInApproval ?? 0}
            trend={summary?.blockedInApproval ? "Review overdue" : undefined}
            tone={summary?.blockedInApproval ? "warning" : "default"}
          />
          <StatCard label="Approved — production queue" value={summary?.approvedCount ?? 0} />
          <StatCard label="Released to production" value={summary?.releasedCount ?? 0} />
          <StatCard label="Live review pending" value={summary?.liveReviewPending ?? 0} />
          <StatCard label="Under development" value={summary?.underDevelopment ?? 0} />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Management decisions">
        <h2 className="workbench-section-title">Decision queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="Final approvals"
            href={`${ROUTES.quality.approvals}?tab=management`}
            linkLabel="Open approvals"
            emptyMessage="No designs waiting for approval."
          >
            {approvals.length === 0 ? (
              <WorkbenchEmpty message="Nothing in the approval queue right now." />
            ) : (
              <ul className="detail-task-list">
                {approvals.slice(0, 8).map((item) => (
                  <WorkbenchListItem
                    key={`${item.designId}-${item.currentLevel.id}`}
                    primaryHref={`${ROUTES.quality.approvals}?tab=management`}
                    primaryLabel={item.design.ideaRef}
                    meta={`${item.currentLevel.name} · ${item.design.collectionName}`}
                    trailing={<StatusBadge status={item.design.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="High priority decisions"
            href={`${ROUTES.quality.approvals}?tab=management`}
            linkLabel="Review"
            emptyMessage="No urgent approval decisions."
          >
            {!highPriority?.length ? (
              <WorkbenchEmpty message="No high-priority designs in the approval queue." />
            ) : (
              <ul className="detail-task-list">
                {highPriority.map((d) => (
                  <WorkbenchListItem
                    key={d.id.toString()}
                    primaryHref={ROUTES.designs.detail(d.id.toString())}
                    primaryLabel={d.ideaRef}
                    meta={d.collectionName}
                    trailing={
                      <>
                        <PriorityBadge priority={d.priority} />
                        <StatusBadge status={d.status} />
                      </>
                    }
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

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

          <WorkbenchQueueCard
            title="Live design review"
            href={`${ROUTES.quality.approvals}?tab=stage`}
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

          <WorkbenchQueueCard
            title="Portfolio in development"
            href={ROUTES.designs.list}
            linkLabel="All designs"
            emptyMessage="No active development."
          >
            <p className="workbench-row-meta">
              {summary?.underDevelopment ?? 0} design(s) actively moving through development
              stages before final approval.
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
