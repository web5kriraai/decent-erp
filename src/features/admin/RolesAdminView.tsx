"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ListRefreshButton } from "@/components/ui/ListRefreshButton";
import { PermissionDenied } from "@/components/PermissionDenied";
import { RbacMatrixGrid } from "@/features/admin/RbacMatrixGrid";
import { useFullRbacMatrix } from "@/hooks/use-admin-roles";
import { PERMISSIONS } from "@/lib/permissions";
import { sessionPermissionsStaleHint } from "@/lib/user-messages";
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
        subtitle="Toggle permissions per role. Your session refreshes on save; other people need a refresh or re-login. Approvals hub tabs stay role-based (Design Head, Checker, Management, Admin)."
        className="list-page__header"
        actions={
          <ListRefreshButton
            onRefresh={() => matrixQuery.refetch()}
            isRefreshing={matrixQuery.isFetching}
          />
        }
      />
      <p className="form-hint m-0 list-page__before">{sessionPermissionsStaleHint()}</p>
      <div className="list-page__body list-page__table">
        <RbacMatrixGrid />
      </div>
    </div>
  );
}
