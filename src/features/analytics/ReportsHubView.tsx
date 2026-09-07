"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppCard } from "@/components/ui/AppCard";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import { IconKpi } from "@/components/icons";

const REPORT_CARDS = [
  {
    title: "Correction Analysis",
    description: "Correction trends and impact.",
    href: ROUTES.analytics.reportsCorrections,
  },
  {
    title: "Design Success",
    description: "Quantity, sales, and margin by design.",
    href: ROUTES.analytics.reportsDesignSuccess,
  },
  {
    title: "Performance KPI",
    description: "Employee performance metrics.",
    href: ROUTES.analytics.kpi,
  },
  {
    title: "Time Report",
    description: "Team time by employee and process.",
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
      />

      <div className="grid gap-4 sm:grid-cols-2 stack-section">
        {REPORT_CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="block no-underline">
            <AppCard
              title={card.title}
              headerAction={<IconKpi size={18} className="text-muted-foreground" />}
            >
              <p className="m-0 text-sm text-muted-foreground">{card.description}</p>
            </AppCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
