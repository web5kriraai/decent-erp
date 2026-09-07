import { SampleStatusReportView } from "@/features/analytics/SampleStatusReportView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("reportsSampleStatus");

export default function SampleStatusReportPage() {
  return <SampleStatusReportView />;
}
