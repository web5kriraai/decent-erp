import { MaterialsView } from "@/features/materials/MaterialsView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("workMaterials");

export default function MaterialsPage() {
  return <MaterialsView />;
}
