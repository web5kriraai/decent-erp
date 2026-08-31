import { KpiDashboardView } from "@/features/analytics/KpiDashboardView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("kpi");

export default function KpiPage() {
  return <KpiDashboardView />;
}
