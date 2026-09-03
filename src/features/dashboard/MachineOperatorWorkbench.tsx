"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { StatusBadge } from "@/components/StatusBadge";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import { AppButtonLink } from "@/components/ui/AppButton";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/config/routes";
import { useMyTasks } from "@/hooks/use-tasks";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";

const DONE = new Set(["COMPLETED", "CANCELLED"]);
const MACHINE_CODES = new Set(["MACHINE_SAMPLE", "SAMPLE_RECEIVE", "RESAMPLE"]);

type MachineTask = {
  id: string;
  status: string;
  effectiveStatus?: string;
  isWaitingOnOthers?: boolean;
  design: { id: string; ideaRef: string };
  subProcess: { code?: string; name: string };
};

function isMachineTask(task: MachineTask) {
  return !!task.subProcess.code && MACHINE_CODES.has(task.subProcess.code);
}

export function MachineOperatorWorkbench() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const tasksQuery = useMyTasks(true);

  const tasks = (tasksQuery.data ?? []).filter(isMachineTask) as MachineTask[];

  const queues = useMemo(() => {
    const actionable = tasks.filter((t) => {
      if (DONE.has(t.status)) return false;
      if (t.effectiveStatus === "COMPLETED") return false;
      if (t.isWaitingOnOthers) return false;
      return true;
    });
    const completed = tasks.filter(
      (t) => DONE.has(t.status) || t.effectiveStatus === "COMPLETED",
    );

    return {
      pending: actionable.filter((t) => ["ASSIGNED", "PENDING"].includes(t.status)),
      running: actionable.filter((t) => t.status === "RUNNING" || t.status === "ON_HOLD"),
      rework: actionable.filter((t) => t.status === "CORRECTION_REQUIRED"),
      completed: completed.slice(0, 10),
    };
  }, [tasks]);

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Machine operator desk"
      subtitle="Sample runs, receive steps, and re-sample rework"
      actions={
        <AppButtonLink href={ROUTES.work.tasks} appVariant="primary" size="sm">
          My Tasks
        </AppButtonLink>
      }
      isLoading={tasksQuery.isLoading}
      isError={tasksQuery.isError}
      error={tasksQuery.error}
      onRetry={() => tasksQuery.refetch()}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="Pending sample work" value={queues.pending.length} />
          <StatCard label="Running / on hold" value={queues.running.length} />
          <StatCard label="Re-sample / correction" value={queues.rework.length} />
          <StatCard label="Completed" value={queues.completed.length} />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Machine operator queues">
        <h2 className="workbench-section-title">Sample queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="Pending machine sample"
            href={ROUTES.work.tasks}
            linkLabel="Open tasks"
            emptyMessage="No pending sample work."
          >
            {queues.pending.length === 0 ? (
              <WorkbenchEmpty message="Nothing waiting to start." />
            ) : (
              <ul className="detail-task-list">
                {queues.pending.map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={task.design.ideaRef}
                    meta={task.subProcess.name}
                    trailing={<StatusBadge status={resolveListItemDisplayStatus(task)} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Running / on hold"
            href={ROUTES.work.tasks}
            linkLabel="Active tasks"
            emptyMessage="No active machine work."
          >
            {queues.running.length === 0 ? (
              <WorkbenchEmpty message="Start a sample task from My Tasks." />
            ) : (
              <ul className="detail-task-list">
                {queues.running.map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={task.design.ideaRef}
                    meta={task.subProcess.name}
                    trailing={<StatusBadge status={resolveListItemDisplayStatus(task)} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Re-sample / returns"
            href={ROUTES.work.tasks}
            linkLabel="Rework queue"
            emptyMessage="No re-sample work."
          >
            {queues.rework.length === 0 ? (
              <WorkbenchEmpty message="Re-sample tasks appear after sample rejection." />
            ) : (
              <ul className="detail-task-list">
                {queues.rework.map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={task.design.ideaRef}
                    meta={task.subProcess.name}
                    trailing={<StatusBadge status="CORRECTION_REQUIRED" />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Recently completed"
            href={ROUTES.work.tasks}
            linkLabel="History"
            emptyMessage="No completed sample steps yet."
          >
            {queues.completed.length === 0 ? (
              <WorkbenchEmpty message="Completed machine steps appear here." />
            ) : (
              <ul className="detail-task-list">
                {queues.completed.map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={task.design.ideaRef}
                    meta={task.subProcess.name}
                    trailing={<StatusBadge status="COMPLETED" />}
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
