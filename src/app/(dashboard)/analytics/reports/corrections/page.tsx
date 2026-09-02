import { CorrectionsReportView } from "@/features/analytics/CorrectionsReportView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("reportsCorrections");

export default function CorrectionsReportPage() {
  return <CorrectionsReportView />;
}
