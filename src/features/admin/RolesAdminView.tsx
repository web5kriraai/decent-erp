"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { PermissionDenied } from "@/components/PermissionDenied";
import { RbacMatrixGrid } from "@/features/admin/RbacMatrixGrid";
import { useFullRbacMatrix } from "@/hooks/use-admin-roles";
import { PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";

export function RolesAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canManage = permissions.includes(PERMISSIONS.MASTER_ADMIN);
  const matrixQuery = useFullRbacMatrix(canManage);

  if (!canManage) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide list-page">
      <PageHeader
        title="Roles & Access"
        subtitle="Pick a role, then turn its permissions on or off. Saving refreshes your session. Other people need to refresh or sign in again."
        className="list-page__header"
        actions={
          <ListRefreshButton
            onRefresh={() => matrixQuery.refetch()}
            isRefreshing={matrixQuery.isFetching}
          />
        }
      />
      <div className="list-page__body">
        <RbacMatrixGrid />
      </div>
    </div>
  );
}
