"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/PermissionDenied";
import { AppButton, AppButtonLink } from "@/components/ui/AppButton";
import { PERMISSIONS } from "@/lib/permissions";
import { ROUTES } from "@/config/routes";
import { IconChevronRight, IconKpi } from "@/components/icons";
import { cn } from "@/lib/utils";

type ReportLink = {
  id: string;
  title: string;
  description: string;
  href: string;
  group: "quality" | "production" | "people";
  permission?: string;
};

type ExportItem = {
  id: string;
  title: string;
  description: string;
  type: string;
};

const REPORT_LINKS: ReportLink[] = [
  {
    id: "corrections",
    title: "Correction Analysis",
    description: "Correction trends and impact by type.",
    href: ROUTES.analytics.reportsCorrections,
    group: "quality",
  },
  {
    id: "sample-status",
    title: "Sample Status",
    description: "Pass / Hold / Reject by stage for the month.",
    href: ROUTES.analytics.reportsSampleStatus,
    group: "quality",
  },
  {
    id: "design-success",
    title: "Design Success",
    description: "Quantity, sales, and margin by design.",
    href: ROUTES.analytics.reportsDesignSuccess,
    group: "production",
  },
  {
    id: "production-start",
    title: "Production Start",
    description: "Accepted or released designs by product type.",
    href: ROUTES.analytics.reportsProductionStart,
    group: "production",
  },
  {
    id: "material",
    title: "Material Analysis",
    description: "Material requests, stock, and indent lines.",
    href: ROUTES.analytics.reportsMaterial,
    group: "production",
  },
  {
    id: "delay",
    title: "Delay Analysis",
    description: "Overdue open tasks by stage and assignee.",
    href: ROUTES.analytics.reportsDelay,
    group: "production",
  },
  {
    id: "kpi",
    title: "Performance KPI",
    description: "Employee scores, grades, and metric weights.",
    href: ROUTES.analytics.kpi,
    group: "people",
  },
  {
    id: "designer-ranking",
    title: "Designer Ranking",
    description: "Weighted KPI ranking for the month.",
    href: ROUTES.analytics.reportsDesignerRanking,
    group: "people",
  },
  {
    id: "time",
    title: "Time Report",
    description: "Team time by employee and process.",
    href: ROUTES.analytics.timeReport,
    group: "people",
    permission: PERMISSIONS.TIME_VIEW_TEAM,
  },
];

const EXPORT_ITEMS: ExportItem[] = [
  {
    id: "design-performance",
    title: "Design Performance",
    description: "Design status by product and season",
    type: "design-performance",
  },
  {
    id: "cost-analysis",
    title: "Cost Analysis",
    description: "Cost entries by design",
    type: "cost-analysis",
  },
  {
    id: "material-analysis",
    title: "Material Analysis",
    description: "Material requests and issues",
    type: "material-analysis",
  },
  {
    id: "delay-analysis",
    title: "Delay Analysis",
    description: "Overdue tasks",
    type: "delay-analysis",
  },
  {
    id: "designer-ranking",
    title: "Designer Ranking",
    description: "Weighted KPI ranking this month",
    type: "designer-ranking",
  },
];

const GROUPS = [
  { id: "quality" as const, title: "Quality", description: "Corrections and sample outcomes" },
  { id: "production" as const, title: "Production", description: "Success and start metrics" },
  { id: "people" as const, title: "People", description: "KPI and time" },
];

export function ReportsHubView() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const enabled = permissions.includes(PERMISSIONS.KPI_ADMIN);
  const canViewTime = permissions.includes(PERMISSIONS.TIME_VIEW_TEAM);
  const [exportType, setExportType] = useState(EXPORT_ITEMS[0]?.type ?? "design-performance");

  const visibleLinks = useMemo(
    () =>
      REPORT_LINKS.filter((link) => {
        if (!link.permission) return true;
        return permissions.includes(link.permission);
      }),
    [permissions],
  );

  if (!enabled) {
    return (
      <div className="page-shell">
        <PermissionDenied permission={PERMISSIONS.KPI_ADMIN} />
      </div>
    );
  }

  function downloadExport() {
    window.location.href = `/api/reports/export?type=${encodeURIComponent(exportType)}`;
  }

  return (
    <div className="page-shell page-shell--wide">
      <PageHeader
        title="Reports Hub"
        subtitle="Browse scorecards and download CSV exports."
        actions={
          <AppButtonLink href={ROUTES.analytics.kpi} appVariant="secondary" size="sm">
            Performance KPI
          </AppButtonLink>
        }
      />

      <div className="reports-hub-layout">
        <section className="reports-hub-directory" aria-label="Interactive reports">
          {GROUPS.map((group) => {
            const links = visibleLinks.filter((l) => l.group === group.id);
            if (links.length === 0) return null;
            return (
              <div key={group.id} className="reports-hub-group">
                <div className="reports-hub-group-head">
                  <h2 className="reports-hub-group-title">{group.title}</h2>
                  <p className="reports-hub-group-desc">{group.description}</p>
                </div>
                <ul className="reports-hub-link-list">
                  {links.map((link) => (
                    <li key={link.id}>
                      <Link href={link.href} className="reports-hub-link">
                        <span className="reports-hub-link-icon" aria-hidden>
                          <IconKpi size={16} />
                        </span>
                        <span className="reports-hub-link-copy">
                          <span className="reports-hub-link-title">{link.title}</span>
                          <span className="reports-hub-link-desc">{link.description}</span>
                        </span>
                        <IconChevronRight
                          size={16}
                          className="reports-hub-link-chevron"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!canViewTime ? (
            <p className="reports-hub-perm-note">
              Time Report is hidden — requires team time access.
            </p>
          ) : null}
        </section>

        <aside className="reports-hub-exports" aria-label="CSV exports">
          <div className="reports-hub-exports-head">
            <h2 className="reports-hub-group-title">CSV Exports</h2>
            <p className="reports-hub-group-desc">Download a dataset without opening a report page.</p>
          </div>
          <ul className="reports-hub-export-list" role="listbox" aria-label="Export type">
            {EXPORT_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={exportType === item.type}
                  className={cn(
                    "reports-hub-export-item",
                    exportType === item.type && "reports-hub-export-item--selected",
                  )}
                  onClick={() => setExportType(item.type)}
                >
                  <span className="reports-hub-link-title">{item.title}</span>
                  <span className="reports-hub-link-desc">{item.description}</span>
                </button>
              </li>
            ))}
          </ul>
          <AppButton type="button" className="reports-hub-export-btn" onClick={downloadExport}>
            Download CSV
          </AppButton>
        </aside>
      </div>
    </div>
  );
}
