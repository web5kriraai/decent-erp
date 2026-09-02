"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import { IconKpi } from "@/components/icons";

const REPORT_CARDS = [
  {
    title: "Correction Analysis",
    description: "Mistake vs improvement trends, extra time, and cost impact by stage.",
    href: ROUTES.analytics.reportsCorrections,
  },
  {
    title: "Design Success",
    description: "Production quantity, sales value, and margin by design for the selected period.",
    href: ROUTES.analytics.reportsDesignSuccess,
  },
  {
    title: "Performance KPI",
    description: "Nine weighted employee metrics with monthly recompute.",
    href: ROUTES.analytics.kpi,
  },
  {
    title: "Time Report",
    description: "Team time by employee, process, and hold reason.",
    href: ROUTES.analytics.timeReport,
  },
] as const;

export function ReportsHubView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Reports & Scorecards"
        subtitle="Management analytics beyond the core KPI dashboard"
      />

      <div className="card-grid stack-section">
        {REPORT_CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="card card-link">
            <div className="card-header">
              <span className="card-title inline-flex items-center gap-2">
                <IconKpi size={18} />
                {card.title}
              </span>
            </div>
            <div className="card-body">
              <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>{card.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
