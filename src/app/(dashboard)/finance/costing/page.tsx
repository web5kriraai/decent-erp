import { CostingView } from "@/features/finance/CostingView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("costing");

export default function CostingPage() {
  return <CostingView />;
}
