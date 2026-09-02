"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { IconCosting, IconTasks } from "@/components/icons";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ROUTES } from "@/config/routes";
import { useMyTasks } from "@/hooks/use-tasks";
import { useDesignsList } from "@/hooks/use-designs";
import { useMyTimeSummary } from "@/hooks/use-time";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";
import { isDashboardOpenTask } from "@/lib/task-list-filters";
import { formatDuration } from "@/lib/services/time-calculation";

const ACTIVE_DESIGN = new Set([
  "DRAFT",
  "IN_PROGRESS",
  "CHECKING",
  "APPROVED",
  "PRODUCTION_HANDOFF",
  "PRODUCTION_ACCEPTED",
]);

export function CostingTeamDashboard() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const tasksQuery = useMyTasks(true);
  const designsQuery = useDesignsList(true);
  const timeQuery = useMyTimeSummary(true);

  const tasks = tasksQuery.data ?? [];
  const costingTasks = tasks.filter(
    (task) =>
      isDashboardOpenTask(task) &&
      (task.subProcess?.code === "COSTING" || task.process?.code === "COSTING"),
  );
  const checkingTasks = tasks.filter(
    (task) =>
      task.subProcess?.code === "COSTING" && (task.effectiveStatus ?? task.status) === "CHECKING",
  );

  const designsForCosting = useMemo(() => {
    const items = designsQuery.data?.items ?? [];
    return items.filter((design) => ACTIVE_DESIGN.has(design.status));
  }, [designsQuery.data?.items]);

  const timeSummary = timeQuery.data;

  return (
    <WorkbenchShell
      firstName={firstName}
      subtitle="Costing queue, margin review, and development cost capture"
      actions={
        <Link href={ROUTES.finance.costing} className="btn btn-primary inline-flex items-center gap-1.5">
          <IconCosting size={16} />
          Open Costing
        </Link>
      }
      isLoading={tasksQuery.isLoading || designsQuery.isLoading || timeQuery.isLoading}
      isError={tasksQuery.isError || designsQuery.isError || timeQuery.isError}
      error={tasksQuery.error ?? designsQuery.error ?? timeQuery.error}
      onRetry={() => {
        tasksQuery.refetch();
        designsQuery.refetch();
        timeQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="My costing tasks" value={costingTasks.length} accent />
          <StatCard label="Awaiting approval" value={checkingTasks.length} />
          <StatCard
            label="Active designs"
            value={designsForCosting.length}
            trend="Eligible for costing"
          />
          <StatCard
            label="Time today"
            value={timeSummary ? formatDuration(timeSummary.totals.activeSeconds) : "—"}
          />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Costing queues">
        <h2 className="workbench-section-title">Priority queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="My costing tasks"
            href={ROUTES.work.tasks}
            linkLabel="My Tasks"
            emptyMessage="No costing tasks assigned right now."
          >
            {costingTasks.length === 0 ? (
              <WorkbenchEmpty message="When a design reaches costing, your task appears here and on My Tasks." />
            ) : (
              <ul className="detail-task-list">
                {costingTasks.slice(0, 6).map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={`${task.design.ideaRef} · ${task.subProcess.name}`}
                    meta={task.design.collectionName}
                    trailing={<StatusBadge status={task.effectiveStatus ?? task.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Designs for costing"
            href={ROUTES.finance.costing}
            linkLabel="Costing workspace"
            emptyMessage="No active designs in pipeline."
          >
            {designsForCosting.length === 0 ? (
              <WorkbenchEmpty message="Designs appear here once they enter the development pipeline." />
            ) : (
              <ul className="detail-task-list">
                {designsForCosting.slice(0, 6).map((design) => (
                  <WorkbenchListItem
                    key={design.id}
                    primaryHref={ROUTES.finance.costing}
                    primaryLabel={design.ideaRef}
                    meta={`${design.collectionName} · ${design.productType?.name ?? "—"}`}
                    trailing={<StatusBadge status={design.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Quick links"
            href={ROUTES.work.tasks}
            linkLabel="All tasks"
            emptyMessage="No quick links available."
          >
            <ul className="detail-task-list">
              <WorkbenchListItem
                primaryHref={ROUTES.work.tasks}
                primaryLabel="My Tasks"
                meta="Start timer and complete costing work"
                trailing={<IconTasks size={16} />}
              />
              <WorkbenchListItem
                primaryHref={ROUTES.finance.costing}
                primaryLabel="Costing entries"
                meta="Add material, time, and machine costs"
                trailing={<IconCosting size={16} />}
              />
              <WorkbenchListItem
                primaryHref={ROUTES.work.myTime}
                primaryLabel="My Time Today"
                meta="Review active and hold time"
              />
            </ul>
          </WorkbenchQueueCard>
        </div>
      </section>
    </WorkbenchShell>
  );
}
