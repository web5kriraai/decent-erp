"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { RoleCatalogList } from "@/features/admin/RoleCatalogView";
import { PERMISSIONS } from "@/lib/permissions";
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
        title="Roles & Responsibilities"
        subtitle="Review all 9 system roles - permissions, duties, and sidebar access"
      />
      <RoleCatalogList />
    </div>
  );
}
