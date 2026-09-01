"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
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
        <Link href={ROUTES.analytics.kpi} className="btn btn-secondary btn-sm">
          KPI dashboard
        </Link>
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
          <StatCard label="Awaiting final approval" value={summary?.approvalPending ?? 0} accent />
          <StatCard label="High priority decisions" value={summary?.highPriorityPending ?? 0} />
          <StatCard
            label="Stuck in approval (30d+)"
            value={summary?.blockedInApproval ?? 0}
            trend={summary?.blockedInApproval ? "Review overdue" : undefined}
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
            href={ROUTES.quality.approvals}
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
                    primaryHref={ROUTES.quality.approvals}
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
            href={ROUTES.quality.approvals}
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
            <p className="workbench-row-meta" style={{ marginBottom: "0.75rem" }}>
              {summary?.approvedCount ?? 0} approved design(s) in the production workflow.
              {summary?.releasedCount
                ? ` ${summary.releasedCount} already released to shop floor.`
                : ""}
            </p>
            <Link href={ROUTES.production.release} className="btn btn-secondary btn-sm">
              View production desk
            </Link>
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Live design review"
            href={ROUTES.work.tasks}
            linkLabel="My tasks"
            emptyMessage="No released designs awaiting live review."
          >
            {!summary?.liveReviewTasks?.length ? (
              <WorkbenchEmpty message="Complete live review on My Tasks after production release." />
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
            <Link href={ROUTES.designs.kanban} className="btn btn-ghost btn-sm">
              Open pipeline
            </Link>
          </WorkbenchQueueCard>
        </div>
      </section>
    </WorkbenchShell>
  );
}
