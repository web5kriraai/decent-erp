import { MasterDataAdminView } from "@/features/admin/MasterDataAdminView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminMasters");

export default function MastersPage() {
  return <MasterDataAdminView />;
}
