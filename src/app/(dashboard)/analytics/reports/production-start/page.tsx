import { ProductionStartReportView } from "@/features/analytics/ProductionStartReportView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("reportsProductionStart");

export default function ProductionStartReportPage() {
  return <ProductionStartReportView />;
}
