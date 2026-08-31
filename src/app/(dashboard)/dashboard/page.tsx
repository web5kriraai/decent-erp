"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconDesigns, IconPlus, IconTasks, IconClock } from "@/components/icons";
import { ROUTES } from "@/config/routes";
import { PERMISSIONS } from "@/lib/permissions";
import { useDesignsList } from "@/hooks/use-designs";
import { useMyTasks } from "@/hooks/use-tasks";
import { useMyTimeSummary } from "@/hooks/use-time";
import { useAdminDashboardStats } from "@/hooks/use-admin-dashboard";
import { formatDuration } from "@/lib/services/time-calculation";
import { RoleOverviewCard } from "@/components/roles/RoleOverviewCard";

export default function DashboardPage() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canViewDesigns = permissions.includes(PERMISSIONS.DESIGN_CREATE);
  const canViewTasks = permissions.includes(PERMISSIONS.TASK_EXECUTE);
  const isMasterAdmin = permissions.includes(PERMISSIONS.MASTER_ADMIN);

  const designsQuery = useDesignsList(canViewDesigns);
  const tasksQuery = useMyTasks(canViewTasks);
  const timeQuery = useMyTimeSummary(canViewTasks);
  const adminDashboardQuery = useAdminDashboardStats(isMasterAdmin);

  const designs = designsQuery.data;
  const tasks = tasksQuery.data;

  const activeDesigns =
    designs?.items.filter((d) => !["CLOSED", "REJECTED"].includes(d.status)).length ?? 0;
  const pendingTasks = tasks?.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status)).length ?? 0;
  const runningTasks = tasks?.filter((t) => t.status === "RUNNING").length ?? 0;

  const isLoading =
    designsQuery.isLoading ||
    tasksQuery.isLoading ||
    timeQuery.isLoading ||
    (isMasterAdmin && adminDashboardQuery.isLoading);
  const timeSummary = timeQuery.data;
  const adminStats = adminDashboardQuery.data;

  return (
    <div className="page-shell">
      <PageHeader
        title={`Welcome back, ${session?.user?.name?.split(" ")[0] ?? "there"}`}
        subtitle="Your design operations at a glance"
        breadcrumbs={[{ label: "Overview" }]}
        actions={
          canViewDesigns ? (
            <Link href={ROUTES.designs.new} className="btn btn-primary inline-flex items-center gap-1.5">
              <IconPlus size={16} />
              New Design
            </Link>
          ) : undefined
        }
      />

      <QueryState
        isLoading={isLoading}
        isError={
          designsQuery.isError ||
          tasksQuery.isError ||
          (isMasterAdmin && adminDashboardQuery.isError)
        }
        error={designsQuery.error ?? tasksQuery.error ?? adminDashboardQuery.error}
        onRetry={() => {
          designsQuery.refetch();
          tasksQuery.refetch();
          if (isMasterAdmin) adminDashboardQuery.refetch();
        }}
        skeletonVariant="stats"
      >
        {session?.user?.roleCode && (
          <div style={{ marginBottom: "1.5rem" }}>
            <RoleOverviewCard
              roleCode={session.user.roleCode}
              permissions={permissions}
            />
          </div>
        )}

        {isMasterAdmin && adminStats && (
          <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
            <StatCard label="Total Ideas" value={adminStats.totalIdeas} accent />
            <StatCard label="Under Development" value={adminStats.underDevelopment} />
            <StatCard label="Open Corrections" value={adminStats.correctionsOpen} />
            <StatCard label="Approved" value={adminStats.approved} />
            <StatCard label="Released" value={adminStats.released} />
            <StatCard
              label="Avg Lead Time"
              value={`${adminStats.averageLeadTimeDays}d`}
              trend="Approved → released pipeline"
            />
          </div>
        )}

        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          {canViewDesigns && (
            <>
              <StatCard label="Total Designs" value={designs?.total ?? 0} accent />
              <StatCard label="Active Designs" value={activeDesigns} trend="Excl. closed & rejected" />
            </>
          )}
          {canViewTasks && (
            <>
              <StatCard label="Open Tasks" value={pendingTasks} accent />
              <StatCard label="Running Now" value={runningTasks} trend="Server-tracked timers" />
              {timeSummary && (
                <>
                  <StatCard
                    label="Active Today"
                    value={formatDuration(timeSummary.totals.activeSeconds)}
                    trend="From TaskTimeEvent"
                  />
                  <StatCard
                    label="Hold Today"
                    value={formatDuration(timeSummary.totals.holdSeconds)}
                    trend={timeSummary.workdayClosed ? "Workday closed" : "Workday open"}
                  />
                </>
              )}
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          {canViewDesigns && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Recent Designs</CardTitle>
                <Link href={ROUTES.designs.list} className="btn btn-ghost btn-sm">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
              {designs && designs.items.length > 0 ? (
                <ul className="detail-task-list">
                  {designs.items.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <div>
                        <Link href={ROUTES.designs.detail(d.id)} className="data-table-link">
                          {d.ideaRef}
                        </Link>
                        <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                          {d.collectionName}
                        </p>
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-state" style={{ padding: "2rem 0" }}>
                  <IconDesigns size={32} style={{ color: "var(--color-neutral-400)", marginBottom: "0.5rem" }} />
                  <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>No designs yet</p>
                  <Link href={ROUTES.designs.new} className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem" }}>
                    Create first design
                  </Link>
                </div>
              )}
              </CardContent>
            </Card>
          )}

          {canViewTasks && (
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Link href={ROUTES.work.myTime} className="card card--interactive" style={{ padding: "1rem", textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <IconClock size={20} style={{ color: "var(--color-primary)" }} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>My Time Today</p>
                      <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                        {timeSummary
                          ? `${formatDuration(timeSummary.totals.activeSeconds)} active · ${formatDuration(timeSummary.totals.holdSeconds)} hold`
                          : "View daily time breakdown"}
                      </p>
                    </div>
                  </div>
                </Link>
                <Link href={ROUTES.work.tasks} className="card card--interactive" style={{ padding: "1rem", textDecoration: "none", color: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <IconTasks size={20} style={{ color: "var(--color-primary)" }} />
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>My Task Board</p>
                      <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                        {pendingTasks} open task{pendingTasks !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </Link>
                {canViewDesigns && (
                  <Link href={ROUTES.designs.list} className="card card--interactive" style={{ padding: "1rem", textDecoration: "none", color: "inherit" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <IconDesigns size={20} style={{ color: "var(--color-primary)" }} />
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>Design Pipeline</p>
                        <p style={{ margin: "0.125rem 0 0", fontSize: "var(--font-size-caption)", color: "var(--color-neutral-500)" }}>
                          Browse all concepts & collections
                        </p>
                      </div>
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </QueryState>
    </div>
  );
}
