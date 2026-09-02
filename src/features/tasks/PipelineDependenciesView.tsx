"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppButtonLink } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { DataTable } from "@/components/DataTable";
import { usePipelineDependencies, type TeamPipelineDependencyItem } from "@/hooks/use-tasks";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";

const SUPERVISOR_PERMISSIONS = [
  PERMISSIONS.DESIGN_CREATE,
  PERMISSIONS.KPI_ADMIN,
  PERMISSIONS.MASTER_ADMIN,
] as const;

function hasSupervisorAccess(permissions: string[]) {
  return SUPERVISOR_PERMISSIONS.some((p) => permissions.includes(p));
}

type DepRow = TeamPipelineDependencyItem & Record<string, unknown>;

export function PipelineDependenciesView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = hasSupervisorAccess(permissions);
  const depsQuery = usePipelineDependencies(enabled);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_CREATE} />
      </div>
    );
  }

  const items = depsQuery.data ?? [];

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Pipeline Dependencies"
        subtitle="Tasks waiting on prior stages, approvals, or the next assignee across your team."
      />

      <QueryState
        isLoading={depsQuery.isLoading}
        isError={depsQuery.isError}
        error={depsQuery.error}
        isEmpty={items.length === 0}
        emptyTitle="No pipeline dependencies"
        emptyDescription="When team members finish a stage, waiting items will appear here."
        skeletonVariant="table"
        onRetry={() => depsQuery.refetch()}
      >
        <AppCard contentClassName="p-0">
          <DataTable<DepRow>
            rows={items as DepRow[]}
            getRowKey={(row) => `${row.taskId}-${row.employeeId}`}
            columns={[
              {
                key: "design",
                header: "Design",
                render: (row) => (
                  <>
                    <Link href={ROUTES.designs.detail(row.design.id)} className="data-table-link">
                      {row.design.ideaRef}
                    </Link>
                    <p className="data-table-subtext">{row.design.collectionName}</p>
                  </>
                ),
              },
              {
                key: "owner",
                header: "Owner",
                render: (row) => (
                  <>
                    {row.employeeName}
                    <p className="data-table-subtext">{row.employeeCode}</p>
                  </>
                ),
              },
              { key: "myStage", header: "Stage" },
              {
                key: "myStatus",
                header: "Status",
                render: (row) => row.myStatus.replace(/_/g, " "),
              },
              { key: "waitingFor", header: "Waiting for" },
              { key: "nextAction", header: "Next action" },
              {
                key: "actions",
                header: "",
                align: "right",
                render: (row) => (
                  <div className="inline-flex flex-wrap justify-end gap-1">
                    {row.nextTaskId ? (
                      <AppButtonLink
                        href={ROUTES.work.taskDetail(row.nextTaskId)}
                        appVariant="ghost"
                        size="sm"
                      >
                        Next task
                      </AppButtonLink>
                    ) : null}
                    <AppButtonLink
                      href={ROUTES.work.taskDetail(row.taskId)}
                      appVariant="ghost"
                      size="sm"
                    >
                      Owner task
                    </AppButtonLink>
                  </div>
                ),
              },
            ]}
          />
        </AppCard>
      </QueryState>
    </div>
  );
}
