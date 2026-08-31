"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { PERMISSIONS } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export async function CorrectionsView() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  if (!permissions.includes(PERMISSIONS.CORRECTION_RAISE)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.CORRECTION_RAISE} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Corrections"
        subtitle="Track mistakes, improvements, and rework responsibility"
      />
      <div className="card">
        <EmptyState
          title="No open corrections"
          description="Corrections raised during sample checking or approval will appear here with structured type and responsible employee."
        />
      </div>
    </div>
  );
}
