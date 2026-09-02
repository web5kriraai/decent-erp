"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/config/routes";
import { useMyTasks } from "@/hooks/use-tasks";
import { useCorrections } from "@/hooks/use-corrections";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";

const DONE = new Set(["COMPLETED", "CANCELLED"]);
const OPEN_CORRECTION = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"]);

type CheckerTask = {
  id: string;
  status: string;
  effectiveStatus?: string;
  isWaitingOnOthers?: boolean;
  design: { id: string; ideaRef: string };
  subProcess: { code?: string; name: string };
};

function isPunchCheck(task: CheckerTask) {
  return task.subProcess.code === "PUNCH_CHECK";
}

export function PunchingCheckerWorkbench() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const tasksQuery = useMyTasks(true);
  const correctionsQuery = useCorrections(undefined, true);

  const tasks = (tasksQuery.data ?? []) as CheckerTask[];
  const corrections = (correctionsQuery.data ?? []).filter((c) => OPEN_CORRECTION.has(c.status));

  const queues = useMemo(() => {
    const actionable = tasks.filter((t) => {
      if (DONE.has(t.status)) return false;
      if (t.effectiveStatus === "COMPLETED") return false;
      if (t.isWaitingOnOthers) return false;
      return isPunchCheck(t);
    });
    const completed = tasks.filter(
      (t) => isPunchCheck(t) && (DONE.has(t.status) || t.effectiveStatus === "COMPLETED"),
    );
    return {
      pending: actionable.filter((t) => t.status !== "CORRECTION_REQUIRED"),
      returned: actionable.filter((t) => t.status === "CORRECTION_REQUIRED"),
      completed: completed.slice(0, 8),
    };
  }, [tasks]);

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Punching checker desk"
      subtitle="Punching file review, returns, and completed checks"
      actions={
        <Link href={ROUTES.work.tasks} className="btn btn-primary btn-sm">
          My Action Center
        </Link>
      }
      isLoading={tasksQuery.isLoading || correctionsQuery.isLoading}
      isError={tasksQuery.isError || correctionsQuery.isError}
      error={tasksQuery.error ?? correctionsQuery.error}
      onRetry={() => {
        tasksQuery.refetch();
        correctionsQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="Pending punch checks" value={queues.pending.length} accent />
          <StatCard label="Returned for rework" value={queues.returned.length + corrections.length} />
          <StatCard label="Completed punch checks" value={queues.completed.length} />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Punching checker queues">
        <h2 className="workbench-section-title">Punching quality queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="Pending punching checks"
            href={ROUTES.work.tasks}
            linkLabel="Open tasks"
            emptyMessage="No punching checks waiting."
          >
            {queues.pending.length === 0 ? (
              <WorkbenchEmpty message="When punching work is submitted, your PUNCH_CHECK task appears here." />
            ) : (
              <ul className="detail-task-list">
                {queues.pending.slice(0, 8).map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={task.design.ideaRef}
                    meta={task.subProcess.name}
                    trailing={<StatusBadge status={task.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Returned punching work"
            href={ROUTES.quality.corrections}
            linkLabel="Corrections"
            emptyMessage="No returned punching checks."
          >
            {queues.returned.length === 0 && corrections.length === 0 ? (
              <WorkbenchEmpty message="Returned punching checks and related corrections appear here." />
            ) : (
              <ul className="detail-task-list">
                {queues.returned.slice(0, 6).map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={task.design.ideaRef}
                    meta={task.subProcess.name}
                    trailing={<StatusBadge status="CORRECTION_REQUIRED" />}
                  />
                ))}
                {corrections.slice(0, 4).map((c) => (
                  <WorkbenchListItem
                    key={c.id}
                    primaryHref={ROUTES.quality.corrections}
                    primaryLabel={c.design.ideaRef}
                    meta={c.rootCause ?? c.correctionType}
                    trailing={<StatusBadge status={c.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Completed punch checks"
            href={ROUTES.work.tasks}
            linkLabel="History"
            emptyMessage="No completed punch checks yet."
          >
            {queues.completed.length === 0 ? (
              <WorkbenchEmpty message="Completed punching checks appear here." />
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
