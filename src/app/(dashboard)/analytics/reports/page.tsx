import { ReportsHubView } from "@/features/analytics/ReportsHubView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("reportsHub");

export default function ReportsHubPage() {
  return <ReportsHubView />;
}
