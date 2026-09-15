"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { RbacMatrixGrid } from "@/features/admin/RbacMatrixGrid";
import { PERMISSIONS } from "@/lib/permissions";
import { sessionPermissionsStaleHint } from "@/lib/user-messages";
import { useSession } from "next-auth/react";

export function RolesAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  if (!permissions.includes(PERMISSIONS.MASTER_ADMIN)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.MASTER_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Roles & Access"
        subtitle="Toggle permissions per role. Your session refreshes on save; other people need a refresh or re-login. Approvals hub tabs stay role-based (Design Head, Checker, Management, Admin)."
      />
      <p className="form-hint m-0">{sessionPermissionsStaleHint()}</p>
      <RbacMatrixGrid />
    </div>
  );
}
