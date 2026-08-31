import { RolesAdminView } from "@/features/admin/RolesAdminView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminRoles");

export default function RolesAdminPage() {
  return <RolesAdminView />;
}
