import { MastersView } from "@/features/admin/MastersView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminMasters");

export default function MastersPage() {
  return <MastersView />;
}
