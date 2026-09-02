"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueryState } from "@/components/ui/QueryState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { usePipelineDependencies } from "@/hooks/use-tasks";
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
        <div className="card">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Owner</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Waiting for</th>
                  <th>Next action</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.taskId}-${item.employeeId}`}>
                    <td>
                      <Link href={ROUTES.designs.detail(item.design.id)} className="data-table-link">
                        {item.design.ideaRef}
                      </Link>
                      <p className="data-table-subtext">{item.design.collectionName}</p>
                    </td>
                    <td>
                      {item.employeeName}
                      <p className="data-table-subtext">{item.employeeCode}</p>
                    </td>
                    <td>{item.myStage}</td>
                    <td>{item.myStatus.replace(/_/g, " ")}</td>
                    <td>{item.waitingFor}</td>
                    <td>{item.nextAction}</td>
                    <td className="data-table-actions">
                      {item.nextTaskId ? (
                        <Link
                          href={ROUTES.work.taskDetail(item.nextTaskId)}
                          className="btn btn-ghost btn-sm"
                        >
                          Next task
                        </Link>
                      ) : null}
                      <Link href={ROUTES.work.taskDetail(item.taskId)} className="btn btn-ghost btn-sm">
                        Owner task
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
