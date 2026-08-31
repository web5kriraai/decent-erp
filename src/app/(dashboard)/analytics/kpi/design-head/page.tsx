import { DesignHeadKpiView } from "@/features/analytics/DesignHeadKpiView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("kpiDesignHead");

export default function DesignHeadKpiPage() {
  return <DesignHeadKpiView />;
}
