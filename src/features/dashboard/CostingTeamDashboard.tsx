"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { IconCosting } from "@/components/icons";
import { AppButtonLink } from "@/components/ui/AppButton";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import { ROUTES } from "@/config/routes";
import { useMyTasks } from "@/hooks/use-tasks";
import { useDesignsList } from "@/hooks/use-designs";
import { useMyTimeSummary } from "@/hooks/use-time";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchQuickActions,
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
      task.subProcess?.code === "COSTING" && resolveListItemDisplayStatus(task) === "CHECKING",
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
        <AppButtonLink
          href={ROUTES.finance.costing}
          appVariant="primary"
          className="inline-flex items-center gap-1.5"
        >
          <IconCosting size={16} />
          Open Costing
        </AppButtonLink>
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
        <WorkbenchQuickActions
          actions={[
            { href: ROUTES.work.tasks, label: "My Tasks", badge: costingTasks.length },
            { href: ROUTES.finance.costing, label: "Costing" },
            { href: ROUTES.work.myTime, label: "My Time" },
          ]}
        />
        <div className="stat-grid workbench-pulse">
          <StatCard label="My costing tasks" value={costingTasks.length} />
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
                    trailing={<StatusBadge status={resolveListItemDisplayStatus(task)} />}
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
        </div>
      </section>
    </WorkbenchShell>
  );
}
