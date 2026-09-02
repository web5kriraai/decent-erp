import { DesignSuccessReportView } from "@/features/analytics/DesignSuccessReportView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("reportsDesignSuccess");

export default function DesignSuccessReportPage() {
  return <DesignSuccessReportView />;
}
