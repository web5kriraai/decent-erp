import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { PermissionDenied } from "@/components/PermissionDenied";
import { PERMISSIONS } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export async function ApprovalsView() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  if (!permissions.includes(PERMISSIONS.DESIGN_APPROVE)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.DESIGN_APPROVE} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Approvals"
        subtitle="Multi-level approval chain for design stages"
      />
      <div className="card">
        <EmptyState
          title="No pending approvals"
          description="Designs awaiting your sign-off will appear here. Each decision is audited with server timestamp."
        />
      </div>
    </div>
  );
}
