"use client";

import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { StatusBadge } from "@/components/StatusBadge";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import { AppButtonLink } from "@/components/ui/AppButton";
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
const QUALITY_CHECK_CODES = new Set(["PUNCH_CHECK", "SAMPLE_CHECK"]);

type CheckerTask = {
  id: string;
  status: string;
  effectiveStatus?: string;
  isWaitingOnOthers?: boolean;
  design: { id: string; ideaRef: string };
  subProcess: { code?: string; name: string };
};

function isQualityCheck(task: CheckerTask) {
  return !!task.subProcess.code && QUALITY_CHECK_CODES.has(task.subProcess.code);
}

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

  const corrections = (correctionsQuery.data ?? []).filter((c) => OPEN_CORRECTION.has(c.status));
  const managementApprovals = approvalsQuery.data ?? [];

  const queues = useMemo(() => {
    const tasks = (tasksQuery.data ?? []) as CheckerTask[];
    const actionable = tasks.filter((t) => {
      if (DONE.has(t.status)) return false;
      if (t.effectiveStatus === "COMPLETED") return false;
      if (t.isWaitingOnOthers) return false;
      return isQualityCheck(t);
    });
    const completed = tasks.filter(
      (t) => isQualityCheck(t) && (DONE.has(t.status) || t.effectiveStatus === "COMPLETED"),
    );
    const returned = actionable.filter((t) => t.status === "CORRECTION_REQUIRED");

    return {
      pendingPunch: actionable.filter((t) => isPunchCheck(t) && t.status !== "CORRECTION_REQUIRED"),
      pendingSample: actionable.filter((t) => isSampleCheck(t) && t.status !== "CORRECTION_REQUIRED"),
      returned,
      completedChecks: completed.slice(0, 8),
    };
  }, [tasksQuery.data]);

  const pendingTotal = queues.pendingPunch.length + queues.pendingSample.length;

  return (
    <WorkbenchShell
      firstName={firstName}
      title="Sample checker desk"
      subtitle="Punch checks, sample checks, management sign-off, and completed reviews"
      actions={
        <AppButtonLink href={ROUTES.work.tasks} appVariant="primary" size="sm">
          My Action Center
        </AppButtonLink>
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
          <StatCard label="Pending quality checks" value={pendingTotal} />
          <StatCard label="Punch checks waiting" value={queues.pendingPunch.length} />
          <StatCard label="Sample checks waiting" value={queues.pendingSample.length} />
          <StatCard label="Returned / correction" value={queues.returned.length + corrections.length} />
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
            title="Pending punch checks"
            href={ROUTES.work.tasks}
            linkLabel="Open tasks"
            emptyMessage="No punch checks waiting."
          >
            {queues.pendingPunch.length === 0 ? (
              <WorkbenchEmpty message="When punching work is submitted, your PUNCH_CHECK task appears here." />
            ) : (
              <ul className="detail-task-list">
                {queues.pendingPunch.slice(0, 8).map((task) => (
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
                    trailing={<StatusBadge status={resolveListItemDisplayStatus(task)} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Returned checks"
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
            {queues.completedChecks.length === 0 ? (
              <WorkbenchEmpty message="Completed punch and sample checks appear here." />
            ) : (
              <ul className="detail-task-list">
                {queues.completedChecks.map((task) => (
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
