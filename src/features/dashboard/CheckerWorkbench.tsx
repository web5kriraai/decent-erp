"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ROUTES } from "@/config/routes";
import { useMyTasks } from "@/hooks/use-tasks";
import { useCorrections } from "@/hooks/use-corrections";
import { usePendingApprovals } from "@/hooks/use-approvals";
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

function isSampleCheck(task: CheckerTask) {
  return task.subProcess.code === "SAMPLE_CHECK";
}

export function CheckerWorkbench() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const tasksQuery = useMyTasks(true);
  const correctionsQuery = useCorrections(undefined, true);
  const approvalsQuery = usePendingApprovals(true);

  const tasks = (tasksQuery.data ?? []) as CheckerTask[];
  const corrections = (correctionsQuery.data ?? []).filter((c) => OPEN_CORRECTION.has(c.status));
  const managementApprovals = approvalsQuery.data ?? [];

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
    const returned = actionable.filter((t) => t.status === "CORRECTION_REQUIRED");

    return {
      pendingPunch: actionable.filter((t) => isPunchCheck(t) && t.status !== "CORRECTION_REQUIRED"),
      pendingSample: actionable.filter((t) => isSampleCheck(t) && t.status !== "CORRECTION_REQUIRED"),
      returned,
      completedPunch: completed.filter(isPunchCheck).slice(0, 8),
      completedSample: completed.filter(isSampleCheck).slice(0, 8),
    };
  }, [tasks]);

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Quality checker desk"
      subtitle="Punching checks, sample checks, returns, and completed reviews"
      actions={
        <Link href={ROUTES.work.tasks} className="btn btn-primary btn-sm">
          My Action Center
        </Link>
      }
      isLoading={tasksQuery.isLoading || correctionsQuery.isLoading || approvalsQuery.isLoading}
      isError={tasksQuery.isError || correctionsQuery.isError || approvalsQuery.isError}
      error={tasksQuery.error ?? correctionsQuery.error ?? approvalsQuery.error}
      onRetry={() => {
        tasksQuery.refetch();
        correctionsQuery.refetch();
        approvalsQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="Pending punching checks" value={queues.pendingPunch.length} accent />
          <StatCard label="Pending sample checks" value={queues.pendingSample.length} />
          <StatCard label="Returned / correction" value={queues.returned.length + corrections.length} />
          <StatCard
            label="Completed checks"
            value={queues.completedPunch.length + queues.completedSample.length}
          />
          <StatCard label="Management sign-off" value={managementApprovals.length} />
        </div>
      </div>

      <section className="workbench-queues" aria-label="Checker queues">
        <h2 className="workbench-section-title">Quality queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="Management sign-off"
            href={`${ROUTES.quality.approvals}?tab=management`}
            linkLabel="Open approvals"
            emptyMessage="No designs waiting for checker sign-off."
          >
            {managementApprovals.length === 0 ? (
              <WorkbenchEmpty message="When a design is submitted for final approval, your level appears here first." />
            ) : (
              <ul className="detail-task-list">
                {managementApprovals.slice(0, 6).map((item) => (
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
            title="Pending punching checks"
            href={ROUTES.work.tasks}
            linkLabel="Open tasks"
            emptyMessage="No punching checks waiting."
          >
            {queues.pendingPunch.length === 0 ? (
              <WorkbenchEmpty message="No punching checks in your queue." />
            ) : (
              <ul className="detail-task-list">
                {queues.pendingPunch.slice(0, 8).map((task) => (
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
            title="Pending sample checks"
            href={ROUTES.work.tasks}
            linkLabel="Open tasks"
            emptyMessage="No sample checks waiting."
          >
            {queues.pendingSample.length === 0 ? (
              <WorkbenchEmpty message="No sample checks in your queue." />
            ) : (
              <ul className="detail-task-list">
                {queues.pendingSample.slice(0, 8).map((task) => (
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
            title="Returned punching / sample"
            href={ROUTES.quality.corrections}
            linkLabel="Corrections"
            emptyMessage="No returned checks."
          >
            {queues.returned.length === 0 && corrections.length === 0 ? (
              <WorkbenchEmpty message="Nothing returned for rework." />
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
            title="Completed checks"
            href={ROUTES.work.tasks}
            linkLabel="History"
            emptyMessage="No completed checks yet."
          >
            {queues.completedPunch.length + queues.completedSample.length === 0 ? (
              <WorkbenchEmpty message="Completed punching and sample checks appear here." />
            ) : (
              <ul className="detail-task-list">
                {[...queues.completedPunch, ...queues.completedSample].slice(0, 8).map((task) => (
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
