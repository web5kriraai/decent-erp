"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { WorkbenchShell } from "@/features/dashboard/workbench-shared";
import { IconPlus } from "@/components/icons";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { canRoleSeeManagementSignOff } from "@/lib/approval-hub-rbac";
import { useDesignsList } from "@/hooks/use-designs";
import { useMyTasks } from "@/hooks/use-tasks";
import { useMyTimeSummary } from "@/hooks/use-time";
import { usePendingApprovals } from "@/hooks/use-approvals";
import { useCorrections } from "@/hooks/use-corrections";
import { useApprovedDesigns } from "@/hooks/use-production";
import { useAdminDashboardStats } from "@/hooks/use-admin-dashboard";
import { formatDuration } from "@/lib/services/time-calculation";
import { isDashboardOpenTask } from "@/lib/task-list-filters";
import { resolveListItemDisplayStatus } from "@/lib/task-action-display";
import { compareTasksByPriority, resolveEffectiveTaskPriority } from "@/lib/task-priority";
import { PriorityBadge } from "@/components/ui/PriorityBadge";

const OPEN_CORRECTION = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"]);
const CLOSED_DESIGN = new Set(["CLOSED", "REJECTED", "PRODUCTION_RELEASED", "LIVE"]);

function QueueEmpty({ message }: { message: string }) {
  return (
    <p className="workbench-empty">{message}</p>
  );
}

export function ExecutorWorkbench() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const roleCode = session?.user?.roleCode;

  const canCreateDesign = hasPermission(permissions, PERMISSIONS.DESIGN_CREATE);
  const canAssign = hasPermission(permissions, PERMISSIONS.DESIGN_ASSIGN);
  const canExecute = hasPermission(permissions, PERMISSIONS.TASK_EXECUTE);
  const showManagementApprovals = canRoleSeeManagementSignOff(roleCode);
  const canCorrections = hasPermission(permissions, PERMISSIONS.CORRECTION_RAISE);
  const canCost = hasPermission(permissions, PERMISSIONS.COST_VIEW);
  const canRelease = hasPermission(permissions, PERMISSIONS.PRODUCTION_RELEASE);
  const isMasterAdmin = hasPermission(permissions, PERMISSIONS.MASTER_ADMIN);
  const canViewPipeline = canCreateDesign || canAssign;

  const designsQuery = useDesignsList(canViewPipeline || canCost);
  const tasksQuery = useMyTasks(canExecute);
  const timeQuery = useMyTimeSummary(canExecute);
  const approvalsQuery = usePendingApprovals(showManagementApprovals);
  const correctionsQuery = useCorrections(undefined, canCorrections);
  const releaseQuery = useApprovedDesigns(canRelease);
  const adminQuery = useAdminDashboardStats(isMasterAdmin);

  const designs = designsQuery.data?.items ?? [];
  const tasks = tasksQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const corrections = (correctionsQuery.data ?? []).filter((c) =>
    OPEN_CORRECTION.has(c.status),
  );
  const readyToRelease = releaseQuery.data ?? [];
  const timeSummary = timeQuery.data;
  const adminStats = adminQuery.data;

  const openTasks = tasks.filter(isDashboardOpenTask);
  const runningTasks = openTasks.filter((t) => t.status === "RUNNING");
  const activeDesigns = designs.filter((d) => !CLOSED_DESIGN.has(d.status));

  const isLoading =
    (canViewPipeline && designsQuery.isLoading) ||
    (canCost && !canViewPipeline && designsQuery.isLoading) ||
    (canExecute && (tasksQuery.isLoading || timeQuery.isLoading)) ||
    (showManagementApprovals && approvalsQuery.isLoading) ||
    (canCorrections && correctionsQuery.isLoading) ||
    (canRelease && releaseQuery.isLoading) ||
    (isMasterAdmin && adminQuery.isLoading);

  const isError =
    designsQuery.isError ||
    tasksQuery.isError ||
    (canExecute && timeQuery.isError) ||
    approvalsQuery.isError ||
    correctionsQuery.isError ||
    releaseQuery.isError ||
    (isMasterAdmin && adminQuery.isError);

  function refetchAll() {
    if (canViewPipeline || canCost) designsQuery.refetch();
    if (canExecute) {
      tasksQuery.refetch();
      timeQuery.refetch();
    }
    if (showManagementApprovals) approvalsQuery.refetch();
    if (canCorrections) correctionsQuery.refetch();
    if (canRelease) releaseQuery.refetch();
    if (isMasterAdmin) adminQuery.refetch();
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <WorkbenchShell
      firstName={firstName}
      subtitle="Your work for today"
      actions={
        canCreateDesign ? (
          <AppButtonLink
            href={ROUTES.designs.new}
            appVariant="primary"
            className="inline-flex items-center gap-1.5"
          >
            <IconPlus size={16} />
            New Design
          </AppButtonLink>
        ) : undefined
      }
      isLoading={isLoading}
      isError={isError}
      error={
        designsQuery.error ??
        tasksQuery.error ??
        (canExecute ? timeQuery.error : undefined) ??
        approvalsQuery.error ??
        correctionsQuery.error ??
        releaseQuery.error ??
        adminQuery.error
      }
      onRetry={refetchAll}
    >
        <div className="workbench-overview">
          <div className="stat-grid workbench-pulse">
            {canExecute && (
              <>
                <StatCard label="Open Tasks" value={openTasks.length} />
                <StatCard label="Running Now" value={runningTasks.length} />
                {timeSummary && (
                  <StatCard
                    label="Active Today"
                    value={formatDuration(timeSummary.totals.activeSeconds)}
                    trend={timeSummary.workdayClosed ? "Workday closed" : "Workday open"}
                  />
                )}
              </>
            )}
            {showManagementApprovals && (
              <StatCard label="Pending Approvals" value={approvals.length} />
            )}
            {canCorrections && (
              <StatCard label="My open corrections" value={corrections.length} />
            )}
            {canViewPipeline && (
              <StatCard
                label="Active Designs"
                value={activeDesigns.length}
              />
            )}
            {canRelease && (
              <StatCard label="Ready to Release" value={readyToRelease.length} />
            )}
            {isMasterAdmin && adminStats && (
              <>
                <StatCard label="Under Development" value={adminStats.underDevelopment} />
                {!canCorrections ? (
                  <StatCard label="My open corrections" value={adminStats.correctionsOpen} />
                ) : null}
                <StatCard
                  label="Avg Lead Time"
                  value={`${adminStats.averageLeadTimeDays}d`}
                  trend="Approved → released"
                />
              </>
            )}
          </div>
        </div>

        <section className="workbench-queues" aria-label="Action queue">
          <h2 className="workbench-section-title">Action queue</h2>
          <div className="workbench-queue-grid">
            {canExecute && (
              <AppCard
                title="My tasks"
                headerAction={
                  <AppButtonLink href={ROUTES.work.tasks} appVariant="ghost" size="sm">
                    Open board
                  </AppButtonLink>
                }
              >
                  {openTasks.length === 0 ? (
                    <QueueEmpty message="No tasks ready yet — prior stages must finish first." />
                  ) : (
                    <ul className="detail-task-list">
                      {[...openTasks]
                        .sort((a, b) => {
                          if (a.status === "RUNNING" && b.status !== "RUNNING") return -1;
                          if (b.status === "RUNNING" && a.status !== "RUNNING") return 1;
                          return compareTasksByPriority(
                            {
                              priority: resolveEffectiveTaskPriority(a.priority, a.design.priority),
                              dueAt: a.dueAt,
                              design: a.design,
                            },
                            {
                              priority: resolveEffectiveTaskPriority(b.priority, b.design.priority),
                              dueAt: b.dueAt,
                              design: b.design,
                            },
                          );
                        })
                        .slice(0, 6)
                        .map((task) => (
                          <li key={task.id}>
                            <div>
                              <div className="task-list-item-head">
                                <Link
                                  href={ROUTES.work.taskDetail(task.id)}
                                  className="data-table-link"
                                >
                                  {task.design.ideaRef} · {task.subProcess.name}
                                </Link>
                                <PriorityBadge
                                  priority={resolveEffectiveTaskPriority(
                                    task.priority,
                                    task.design.priority,
                                  )}
                                />
                              </div>
                              <p className="workbench-row-meta">
                                {task.process.name} · {task.design.collectionName}
                              </p>
                            </div>
                            <StatusBadge status={resolveListItemDisplayStatus(task)} />
                          </li>
                        ))}
                    </ul>
                  )}
              </AppCard>
            )}

            {showManagementApprovals && (
              <AppCard
                title="Management approvals"
                headerAction={
                  <AppButtonLink
                    href={`${ROUTES.quality.approvals}?tab=management`}
                    appVariant="ghost"
                    size="sm"
                  >
                    Review all
                  </AppButtonLink>
                }
              >
                  {approvals.length === 0 ? (
                    <QueueEmpty message="Nothing waiting on your approval." />
                  ) : (
                    <ul className="detail-task-list">
                      {approvals.slice(0, 6).map((item) => (
                        <li key={`${item.designId}-${item.currentLevel.id}`}>
                          <div>
                            <Link
                              href={`${ROUTES.quality.approvals}?tab=management`}
                              className="data-table-link"
                            >
                              {item.design.ideaRef}
                            </Link>
                            <p className="workbench-row-meta">
                              {item.currentLevel.name} · {item.design.collectionName}
                            </p>
                          </div>
                          <StatusBadge status={item.design.status} />
                        </li>
                      ))}
                    </ul>
                  )}
              </AppCard>
            )}

            {canCorrections && (
              <AppCard
                title="My corrections"
                headerAction={
                  <AppButtonLink href={ROUTES.quality.corrections} appVariant="ghost" size="sm">
                    View all
                  </AppButtonLink>
                }
              >
                  {corrections.length === 0 ? (
                    <QueueEmpty message="No open corrections assigned to you." />
                  ) : (
                    <ul className="detail-task-list">
                      {corrections.slice(0, 6).map((c) => (
                        <li key={c.id}>
                          <div>
                            <Link
                              href={ROUTES.quality.corrections}
                              className="data-table-link"
                            >
                              {c.design.ideaRef}
                            </Link>
                            <p className="workbench-row-meta">
                              {c.correctionType.replace(/_/g, " ")} · {c.task.subProcess.name}
                            </p>
                          </div>
                          <StatusBadge status={c.status} />
                        </li>
                      ))}
                    </ul>
                  )}
              </AppCard>
            )}

            {canViewPipeline && (
              <AppCard
                title="Active pipeline"
                headerAction={
                  <AppButtonLink href={ROUTES.designs.list} appVariant="ghost" size="sm">
                    All designs
                  </AppButtonLink>
                }
              >
                  {activeDesigns.length === 0 ? (
                    <QueueEmpty message="No active designs in the pipeline." />
                  ) : (
                    <ul className="detail-task-list">
                      {activeDesigns.slice(0, 6).map((d) => (
                        <li key={d.id}>
                          <div>
                            <Link href={ROUTES.designs.detail(d.id)} className="data-table-link">
                              {d.ideaRef}
                            </Link>
                            <p className="workbench-row-meta">{d.collectionName}</p>
                          </div>
                          <StatusBadge status={d.status} />
                        </li>
                      ))}
                    </ul>
                  )}
              </AppCard>
            )}

            {canRelease && (
              <AppCard
                title="Ready to release"
                headerAction={
                  <AppButtonLink href={ROUTES.production.release} appVariant="ghost" size="sm">
                    Release desk
                  </AppButtonLink>
                }
              >
                  {readyToRelease.length === 0 ? (
                    <QueueEmpty message="No approved designs waiting for release." />
                  ) : (
                    <ul className="detail-task-list">
                      {readyToRelease.slice(0, 6).map((d) => (
                        <li key={d.id}>
                          <div>
                            <Link
                              href={ROUTES.production.release}
                              className="data-table-link"
                            >
                              {d.ideaRef}
                            </Link>
                            <p className="workbench-row-meta">
                              {d.collectionName} · {d.productType.name}
                            </p>
                          </div>
                          <StatusBadge status={d.status} />
                        </li>
                      ))}
                    </ul>
                  )}
              </AppCard>
            )}

            {canCost && !canViewPipeline && (
              <AppCard
                title="Designs for costing"
                headerAction={
                  <AppButtonLink href={ROUTES.finance.costing} appVariant="ghost" size="sm">
                    Open costing
                  </AppButtonLink>
                }
              >
                  {designs.length === 0 ? (
                    <QueueEmpty message="No designs available for costing yet." />
                  ) : (
                    <ul className="detail-task-list">
                      {designs.slice(0, 6).map((d) => (
                        <li key={d.id}>
                          <div>
                            <Link href={ROUTES.finance.costing} className="data-table-link">
                              {d.ideaRef}
                            </Link>
                            <p className="workbench-row-meta">{d.collectionName}</p>
                          </div>
                          <StatusBadge status={d.status} />
                        </li>
                      ))}
                    </ul>
                  )}
              </AppCard>
            )}
          </div>
        </section>
    </WorkbenchShell>
  );
}
