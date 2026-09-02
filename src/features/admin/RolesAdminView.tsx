"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as RolesTab)}
        className="action-center-tabs-root"
      >
        <TabsList className="action-center-tabs-list mb-4">
          <TabsTrigger value="matrix" className="action-center-tab-trigger">
            Access matrix
          </TabsTrigger>
          <TabsTrigger value="catalog" className="action-center-tab-trigger">
            Role guide
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <RbacMatrixGrid />
        </TabsContent>
        <TabsContent value="catalog">
          <RoleCatalogList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
