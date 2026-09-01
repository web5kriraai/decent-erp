"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { IconPlus } from "@/components/icons";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { ROUTES } from "@/config/routes";
import { useDesignHeadWorkbench } from "@/hooks/use-workbench";
import { useMyTasks } from "@/hooks/use-tasks";
import { usePendingApprovals } from "@/hooks/use-approvals";
import { useCorrections } from "@/hooks/use-corrections";
import { useDesignsList } from "@/hooks/use-designs";
import {
  WorkbenchEmpty,
  WorkbenchListItem,
  WorkbenchQueueCard,
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";

const DONE_TASK = new Set(["COMPLETED", "CANCELLED"]);
const CLOSED_DESIGN = new Set(["CLOSED", "REJECTED", "PRODUCTION_RELEASED", "LIVE"]);

export function DesignHeadDashboard() {
  const { data: session } = useSession();
  const summaryQuery = useDesignHeadWorkbench(true);
  const tasksQuery = useMyTasks(true);
  const approvalsQuery = usePendingApprovals(true);
  const correctionsQuery = useCorrections(undefined, true);
  const designsQuery = useDesignsList(true);

  const summary = summaryQuery.data;
  const tasks = tasksQuery.data ?? [];
  const openTasks = tasks.filter((t) => {
    if (DONE_TASK.has(t.status)) return false;
    if (t.effectiveStatus === "COMPLETED") return false;
    if (t.isWaitingOnOthers) return false;
    return true;
  });
  const approvals = approvalsQuery.data ?? [];
  const corrections = (correctionsQuery.data ?? []).filter((c) =>
    ["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"].includes(c.status),
  );
  const activeDesigns = (designsQuery.data?.items ?? []).filter(
    (d) => !CLOSED_DESIGN.has(d.status),
  );

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <WorkbenchShell
      firstName={firstName}
      subtitle="Pipeline oversight, approvals, handoffs, and blocked work"
      actions={
        <Link href={ROUTES.designs.new} className="btn btn-primary inline-flex items-center gap-1.5">
          <IconPlus size={16} />
          New Design
        </Link>
      }
      isLoading={
        summaryQuery.isLoading ||
        tasksQuery.isLoading ||
        approvalsQuery.isLoading ||
        correctionsQuery.isLoading ||
        designsQuery.isLoading
      }
      isError={
        summaryQuery.isError ||
        tasksQuery.isError ||
        approvalsQuery.isError ||
        correctionsQuery.isError ||
        designsQuery.isError
      }
      error={
        summaryQuery.error ??
        tasksQuery.error ??
        approvalsQuery.error ??
        correctionsQuery.error ??
        designsQuery.error
      }
      onRetry={() => {
        summaryQuery.refetch();
        tasksQuery.refetch();
        approvalsQuery.refetch();
        correctionsQuery.refetch();
        designsQuery.refetch();
      }}
    >
      <div className="workbench-overview">
        <div className="stat-grid workbench-pulse">
          <StatCard label="My open tasks" value={summary?.myOpenTasks ?? openTasks.length} accent />
          <StatCard label="Stage approvals" value={summary?.stageApprovals?.length ?? 0} />
          <StatCard label="Ready for sign-off" value={summary?.readyForSignOff ?? 0} />
          <StatCard label="Management approvals" value={approvals.length} />
          <StatCard label="Open corrections" value={summary?.openCorrections ?? corrections.length} />
          <StatCard label="Handoff pending" value={summary?.handoffPending ?? 0} />
          <StatCard label="Blocked designs" value={summary?.blockedDesigns.length ?? 0} />
          <StatCard label="Active pipeline" value={summary?.activeDesigns ?? activeDesigns.length} />
          {summary && summary.overdueTasks > 0 ? (
            <StatCard label="Overdue tasks" value={summary.overdueTasks} trend="Needs attention" />
          ) : null}
        </div>
      </div>

      <section className="workbench-queues" aria-label="Design Head queues">
        <h2 className="workbench-section-title">Priority queues</h2>
        <div className="workbench-queue-grid">
          <WorkbenchQueueCard
            title="My stage tasks"
            href={ROUTES.work.tasks}
            linkLabel="Action center"
            emptyMessage="No tasks ready on your action center."
          >
            {openTasks.length === 0 ? (
              <WorkbenchEmpty message="No tasks ready yet — prior stages must finish first." />
            ) : (
              <ul className="detail-task-list">
                {openTasks.slice(0, 6).map((task) => (
                  <WorkbenchListItem
                    key={task.id}
                    primaryHref={ROUTES.work.taskDetail(task.id)}
                    primaryLabel={`${task.design.ideaRef} · ${task.subProcess.name}`}
                    meta={`${task.process.name} · ${task.design.collectionName}`}
                    trailing={<StatusBadge status={task.effectiveStatus ?? task.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Stage approvals"
            href={`${ROUTES.quality.approvals}?tab=stage`}
            linkLabel="Open approvals"
            emptyMessage="No workflow stage approvals waiting on you."
          >
            {!summary?.stageApprovals?.length ? (
              <WorkbenchEmpty message="When costing or sample work is submitted, the approval card appears here and on the design page." />
            ) : (
              <ul className="detail-task-list">
                {summary.stageApprovals.slice(0, 6).map((item) => (
                  <WorkbenchListItem
                    key={item.taskId}
                    primaryHref={ROUTES.designs.detail(item.designId)}
                    primaryLabel={`${item.ideaRef} · ${item.stageName}`}
                    meta={
                      item.workStageName
                        ? `Review ${item.workStageName} · ${item.collectionName}`
                        : item.collectionName
                    }
                    trailing={<StatusBadge status={item.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Ready for sign-off"
            href={`${ROUTES.quality.approvals}?tab=ready`}
            linkLabel="Submit for approval"
            emptyMessage="No designs ready for management sign-off."
          >
            {!summary?.readyForSignOffDesigns?.length ? (
              <WorkbenchEmpty message="When all workflow stages finish, designs appear here for one-click submission to the management chain." />
            ) : (
              <ul className="detail-task-list">
                {summary.readyForSignOffDesigns.map((item) => (
                  <WorkbenchListItem
                    key={item.designId}
                    primaryHref={`${ROUTES.quality.approvals}?tab=ready`}
                    primaryLabel={item.ideaRef}
                    meta={item.collectionName}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Management approvals"
            href={`${ROUTES.quality.approvals}?tab=management`}
            linkLabel="Review all"
            emptyMessage="Nothing waiting on management approval."
          >
            {approvals.length === 0 ? (
              <WorkbenchEmpty message="Nothing waiting on your approval." />
            ) : (
              <ul className="detail-task-list">
                {approvals.slice(0, 6).map((item) => (
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
            title="Production handoff"
            href={ROUTES.work.tasks}
            linkLabel="My tasks"
            emptyMessage="No handoffs waiting on you."
          >
            {!summary?.handoffTasks?.length ? (
              <WorkbenchEmpty message="Complete management approval first — handoff unlocks after Approved status." />
            ) : (
              <ul className="detail-task-list">
                {summary.handoffTasks.map((task) => (
                  <WorkbenchListItem
                    key={task.id.toString()}
                    primaryHref={ROUTES.work.taskDetail(task.id.toString())}
                    primaryLabel={task.design.ideaRef}
                    meta={`${task.subProcess.name} · ${task.design.collectionName}`}
                    trailing={<StatusBadge status={task.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Blocked designs"
            href={ROUTES.designs.kanban}
            linkLabel="Pipeline"
            emptyMessage="No blocked designs in your portfolio."
          >
            {!summary?.blockedDesigns?.length ? (
              <WorkbenchEmpty message="No designs stuck on checking, hold, or correction." />
            ) : (
              <ul className="detail-task-list">
                {summary.blockedDesigns.map((d) => (
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
            title="Open corrections"
            href={ROUTES.quality.corrections}
            linkLabel="View all"
            emptyMessage="No open corrections."
          >
            {corrections.length === 0 ? (
              <WorkbenchEmpty message="No open corrections." />
            ) : (
              <ul className="detail-task-list">
                {corrections.slice(0, 6).map((c) => (
                  <WorkbenchListItem
                    key={c.id}
                    primaryHref={ROUTES.quality.corrections}
                    primaryLabel={c.design.ideaRef}
                    meta={`${c.correctionType.replace(/_/g, " ")} · ${c.task.subProcess.name}`}
                    trailing={<StatusBadge status={c.status} />}
                  />
                ))}
              </ul>
            )}
          </WorkbenchQueueCard>

          <WorkbenchQueueCard
            title="Active pipeline"
            href={ROUTES.designs.list}
            linkLabel="All designs"
            emptyMessage="No active designs."
          >
            {activeDesigns.length === 0 ? (
              <WorkbenchEmpty message="No active designs in the pipeline." />
            ) : (
              <ul className="detail-task-list">
                {activeDesigns.slice(0, 6).map((d) => (
                  <WorkbenchListItem
                    key={d.id}
                    primaryHref={ROUTES.designs.detail(d.id)}
                    primaryLabel={d.ideaRef}
                    meta={d.collectionName}
                    trailing={<StatusBadge status={d.status} />}
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
