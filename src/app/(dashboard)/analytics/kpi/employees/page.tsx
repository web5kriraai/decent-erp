import { KpiDashboardView } from "@/features/analytics/KpiDashboardView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("kpiEmployees");

export default function KpiEmployeesPage() {
  return <KpiDashboardView />;
}
