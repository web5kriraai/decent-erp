"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
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
    title: "Sample Status",
    description: "Sample Pass / Hold / Reject by stage for the month.",
    href: ROUTES.analytics.reportsSampleStatus,
  },
  {
    title: "Production Start",
    description: "Designs accepted or released to production by product type.",
    href: ROUTES.analytics.reportsProductionStart,
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

const EXPORT_REPORTS = [
  { title: "Design Performance", type: "design-performance", description: "Design status by product and season." },
  { title: "Cost Analysis", type: "cost-analysis", description: "Cost entries by design." },
  { title: "Material Analysis", type: "material-analysis", description: "Material requests and issues." },
  { title: "Delay Analysis", type: "delay-analysis", description: "Overdue tasks." },
  { title: "Designer Ranking", type: "designer-ranking", description: "Weighted KPI ranking this month." },
  { title: "Employee Performance", type: "designer-ranking", description: "Export employee weighted scores." },
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
      <PageHeader title="Reports & Scorecards" />

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

      <h3 className="mt-6 mb-3 text-base font-semibold">CSV Exports</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORT_REPORTS.map((card) => (
          <AppCard key={card.type + card.title} title={card.title}>
            <p className="m-0 mb-3 text-sm text-muted-foreground">{card.description}</p>
            <AppButton
              type="button"
              size="sm"
              appVariant="secondary"
              onClick={() => {
                window.location.href = `/api/reports/export?type=${encodeURIComponent(card.type)}`;
              }}
            >
              Export CSV
            </AppButton>
          </AppCard>
        ))}
      </div>
    </div>
  );
}
