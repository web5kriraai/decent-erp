import { ProductionReleaseView } from "@/features/production/ProductionReleaseView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("productionRelease");

export default function ProductionReleasePage() {
  return <ProductionReleaseView />;
}
