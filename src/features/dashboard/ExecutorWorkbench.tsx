"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WorkbenchShell,
} from "@/features/dashboard/workbench-shared";
import {
  IconApprovals,
  IconClock,
  IconCorrections,
  IconCosting,
  IconDesigns,
  IconKpi,
  IconMasters,
  IconPlus,
  IconTasks,
  IconUsers,
  IconWorkflow,
} from "@/components/icons";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { useDesignsList } from "@/hooks/use-designs";
import { useMyTasks } from "@/hooks/use-tasks";
import { useMyTimeSummary } from "@/hooks/use-time";
import { usePendingApprovals } from "@/hooks/use-approvals";
import { useCorrections } from "@/hooks/use-corrections";
import { useApprovedDesigns } from "@/hooks/use-production";
import { useAdminDashboardStats } from "@/hooks/use-admin-dashboard";
import { formatDuration } from "@/lib/services/time-calculation";
import { isDashboardOpenTask } from "@/lib/task-list-filters";
import type { ComponentType } from "react";

const CLOSED_DESIGN = new Set(["CLOSED", "REJECTED", "PRODUCTION_RELEASED", "LIVE"]);
const OPEN_CORRECTION = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS", "CHECKING"]);

type Shortcut = {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  badge?: number;
};

function QueueEmpty({ message }: { message: string }) {
  return (
    <p className="workbench-empty">{message}</p>
  );
}

export function ExecutorWorkbench() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  const canCreateDesign = hasPermission(permissions, PERMISSIONS.DESIGN_CREATE);
  const canAssign = hasPermission(permissions, PERMISSIONS.DESIGN_ASSIGN);
  const canExecute = hasPermission(permissions, PERMISSIONS.TASK_EXECUTE);
  const canApprove = hasPermission(permissions, PERMISSIONS.DESIGN_APPROVE);
  const canCorrections = hasPermission(permissions, PERMISSIONS.CORRECTION_RAISE);
  const canCost = hasPermission(permissions, PERMISSIONS.COST_VIEW);
  const canRelease = hasPermission(permissions, PERMISSIONS.PRODUCTION_RELEASE);
  const canTeamTime = hasPermission(permissions, PERMISSIONS.TIME_VIEW_TEAM);
  const canKpi = hasPermission(permissions, PERMISSIONS.KPI_ADMIN);
  const isMasterAdmin = hasPermission(permissions, PERMISSIONS.MASTER_ADMIN);
  const canViewPipeline = canCreateDesign || canAssign;

  const designsQuery = useDesignsList(canViewPipeline || canCost);
  const tasksQuery = useMyTasks(canExecute);
  const timeQuery = useMyTimeSummary(canExecute);
  const approvalsQuery = usePendingApprovals(canApprove);
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
  const waitingTasks = tasks.filter((t) => t.isWaitingOnOthers);
  const runningTasks = openTasks.filter((t) => t.status === "RUNNING");
  const activeDesigns = designs.filter((d) => !CLOSED_DESIGN.has(d.status));

  const isLoading =
    (canViewPipeline && designsQuery.isLoading) ||
    (canCost && !canViewPipeline && designsQuery.isLoading) ||
    (canExecute && (tasksQuery.isLoading || timeQuery.isLoading)) ||
    (canApprove && approvalsQuery.isLoading) ||
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

  const shortcuts: Shortcut[] = [];
  if (canCreateDesign) {
    shortcuts.push({
      id: "new-design",
      label: "New Design",
      href: ROUTES.designs.new,
      description: "Start a concept",
      icon: IconPlus,
    });
    shortcuts.push({
      id: "pipeline",
      label: "Pipeline",
      href: ROUTES.designs.kanban,
      description: `${activeDesigns.length} active`,
      icon: IconDesigns,
      badge: activeDesigns.length,
    });
  }
  if (canExecute) {
    shortcuts.push({
      id: "my-tasks",
      label: "My Tasks",
      href: ROUTES.work.tasks,
      description: `${openTasks.length} open`,
      icon: IconTasks,
      badge: openTasks.length,
    });
    shortcuts.push({
      id: "my-time",
      label: "My Time",
      href: ROUTES.work.myTime,
      description: timeSummary
        ? formatDuration(timeSummary.totals.activeSeconds)
        : "Today",
      icon: IconClock,
    });
  }
  if (canApprove) {
    shortcuts.push({
      id: "approvals",
      label: "Approvals",
      href: `${ROUTES.quality.approvals}?tab=management`,
      description: `${approvals.length} waiting`,
      icon: IconApprovals,
      badge: approvals.length,
    });
  }
  if (canCorrections) {
    shortcuts.push({
      id: "corrections",
      label: "Corrections",
      href: ROUTES.quality.corrections,
      description: `${corrections.length} open`,
      icon: IconCorrections,
      badge: corrections.length,
    });
  }
  if (canCost) {
    shortcuts.push({
      id: "costing",
      label: "Costing",
      href: ROUTES.finance.costing,
      description: "Enter costs",
      icon: IconCosting,
    });
  }
  if (canRelease) {
    shortcuts.push({
      id: "release",
      label: "Release",
      href: ROUTES.production.release,
      description: `${readyToRelease.length} ready`,
      icon: IconWorkflow,
      badge: readyToRelease.length,
    });
  }
  if (canTeamTime) {
    shortcuts.push({
      id: "team-time",
      label: "Team Time",
      href: ROUTES.admin.timeLive,
      description: "Live timers",
      icon: IconClock,
    });
  }
  if (canKpi) {
    shortcuts.push({
      id: "kpi",
      label: "KPI",
      href: ROUTES.analytics.kpi,
      description: "Scores",
      icon: IconKpi,
    });
  }
  if (isMasterAdmin) {
    shortcuts.push({
      id: "employees",
      label: "Employees",
      href: ROUTES.admin.employees,
      description: "Directory",
      icon: IconUsers,
    });
    shortcuts.push({
      id: "masters",
      label: "Masters",
      href: ROUTES.admin.masters,
      description: "Config",
      icon: IconMasters,
    });
  }

  function refetchAll() {
    if (canViewPipeline || canCost) designsQuery.refetch();
    if (canExecute) {
      tasksQuery.refetch();
      timeQuery.refetch();
    }
    if (canApprove) approvalsQuery.refetch();
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
          <Link href={ROUTES.designs.new} className="btn btn-primary inline-flex items-center gap-1.5">
            <IconPlus size={16} />
            New Design
          </Link>
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
                <StatCard label="Open Tasks" value={openTasks.length} accent />
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
            {canApprove && (
              <StatCard label="Pending Approvals" value={approvals.length} accent={!canExecute} />
            )}
            {canCorrections && (
              <StatCard label="My open corrections" value={corrections.length} />
            )}
            {canViewPipeline && (
              <StatCard
                label="Active Designs"
                value={activeDesigns.length}
                accent={!canExecute && !canApprove}
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

          {shortcuts.length > 0 && (
            <section className="workbench-shortcuts" aria-label="Shortcuts">
              <h2 className="workbench-section-title">Shortcuts</h2>
              <div className="workbench-shortcut-grid">
                {shortcuts.map((item) => {
                  const Icon = item.icon;
                  const showBadge = typeof item.badge === "number" && item.badge > 0;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="workbench-shortcut"
                    >
                      {showBadge && (
                        <span className="workbench-shortcut-badge" aria-label={`${item.badge} items`}>
                          {item.badge}
                        </span>
                      )}
                      <span className="workbench-shortcut-icon">
                        <Icon size={18} />
                      </span>
                      <span className="workbench-shortcut-label">{item.label}</span>
                      <span className="workbench-shortcut-desc">{item.description}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <section className="workbench-queues" aria-label="Action queue">
          <h2 className="workbench-section-title">Action queue</h2>
          <div className="workbench-queue-grid">
            {canExecute && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>My tasks</CardTitle>
                  <Link href={ROUTES.work.tasks} className="btn btn-ghost btn-sm">
                    Open board
                  </Link>
                </CardHeader>
                <CardContent>
                  {openTasks.length === 0 ? (
                    <QueueEmpty message="No tasks ready yet — prior stages must finish first." />
                  ) : (
                    <ul className="detail-task-list">
                      {[...openTasks]
                        .sort((a, b) => {
                          if (a.status === "RUNNING" && b.status !== "RUNNING") return -1;
                          if (b.status === "RUNNING" && a.status !== "RUNNING") return 1;
                          return 0;
                        })
                        .slice(0, 6)
                        .map((task) => (
                          <li key={task.id}>
                            <div>
                              <Link
                                href={ROUTES.work.taskDetail(task.id)}
                                className="data-table-link"
                              >
                                {task.design.ideaRef} · {task.subProcess.name}
                              </Link>
                              <p className="workbench-row-meta">
                                {task.process.name} · {task.design.collectionName}
                              </p>
                            </div>
                            <StatusBadge status={task.effectiveStatus ?? task.status} />
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {canExecute && waitingTasks.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Waiting for approval</CardTitle>
                  <Link href={ROUTES.work.tasks} className="btn btn-ghost btn-sm">
                    Action center
                  </Link>
                </CardHeader>
                <CardContent>
                  <ul className="detail-task-list">
                    {waitingTasks.slice(0, 6).map((task) => (
                      <li key={task.id}>
                        <div>
                          <Link
                            href={ROUTES.work.taskDetail(task.id)}
                            className="data-table-link"
                          >
                            {task.design.ideaRef} · {task.subProcess.name}
                          </Link>
                          <p className="workbench-row-meta">
                            Waiting on {task.waitingOnAssignee ?? "approver"} —{" "}
                            {task.waitingOnStage ?? "stage review"}
                          </p>
                        </div>
                        <StatusBadge status="CHECKING" />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {canApprove && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Management approvals</CardTitle>
                  <Link href={`${ROUTES.quality.approvals}?tab=management`} className="btn btn-ghost btn-sm">
                    Review all
                  </Link>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}

            {canCorrections && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>My corrections</CardTitle>
                  <Link href={ROUTES.quality.corrections} className="btn btn-ghost btn-sm">
                    View all
                  </Link>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}

            {canViewPipeline && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Active pipeline</CardTitle>
                  <Link href={ROUTES.designs.list} className="btn btn-ghost btn-sm">
                    All designs
                  </Link>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}

            {canRelease && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Ready to release</CardTitle>
                  <Link href={ROUTES.production.release} className="btn btn-ghost btn-sm">
                    Release desk
                  </Link>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}

            {canCost && !canViewPipeline && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Designs for costing</CardTitle>
                  <Link href={ROUTES.finance.costing} className="btn btn-ghost btn-sm">
                    Open costing
                  </Link>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            )}
          </div>
        </section>
    </WorkbenchShell>
  );
}
