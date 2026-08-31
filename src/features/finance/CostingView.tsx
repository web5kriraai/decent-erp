import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { StatCard } from "@/components/ui/StatCard";
import { PERMISSIONS } from "@/lib/permissions";
import { auth } from "@/lib/auth";

export async function CostingView() {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];

  if (!permissions.includes(PERMISSIONS.COST_VIEW)) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.COST_VIEW} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        title="Costing"
        subtitle="Development cost, standard cost, and margin review per design"
      />
      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        <StatCard label="Designs in Costing" value="-" trend="Awaiting cost entries" accent />
        <StatCard label="Avg. Dev Cost" value="-" />
        <StatCard label="Margin Alerts" value="0" trend="Below threshold" />
      </div>
      <div className="card">
        <p style={{ color: "var(--color-neutral-500)", margin: 0 }}>
          Cost rollup combines employee time, material, machine, and correction rework.
          Mandatory costing must be complete before final approval.
        </p>
      </div>
    </div>
  );
}
