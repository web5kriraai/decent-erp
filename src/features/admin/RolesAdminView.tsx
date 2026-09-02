"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { RbacMatrixGrid } from "@/features/admin/RbacMatrixGrid";
import { RoleCatalogList } from "@/features/admin/RoleCatalogView";
import { PERMISSIONS } from "@/lib/permissions";
import { useSession } from "next-auth/react";

type RolesTab = "matrix" | "catalog";

export function RolesAdminView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const [tab, setTab] = useState<RolesTab>("matrix");

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
        subtitle="Grant or revoke what each role can do across the system"
      />

      <div className="action-center-tabs-list mb-4" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "matrix"}
          className={`action-center-tab-trigger ${tab === "matrix" ? "action-center-tab--active" : ""}`}
          onClick={() => setTab("matrix")}
        >
          Access matrix
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "catalog"}
          className={`action-center-tab-trigger ${tab === "catalog" ? "action-center-tab--active" : ""}`}
          onClick={() => setTab("catalog")}
        >
          Role guide
        </button>
      </div>

      {tab === "matrix" ? <RbacMatrixGrid /> : <RoleCatalogList />}
    </div>
  );
}
