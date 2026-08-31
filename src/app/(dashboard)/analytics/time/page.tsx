import { EmployeeTimeReportView } from "@/features/time/EmployeeTimeReportView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("timeReport");

export default function TimeReportPage() {
  return <EmployeeTimeReportView />;
}
