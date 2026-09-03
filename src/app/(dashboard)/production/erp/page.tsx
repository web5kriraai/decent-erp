import { ErpChainView } from "@/features/production/ErpChainView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("productionErpChain");

export default function ProductionErpChainPage() {
  return <ErpChainView />;
}
