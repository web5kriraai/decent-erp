import { EmployeesAdminView } from "@/features/admin/EmployeesAdminView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminEmployees");

export default function AdminEmployeesPage() {
  return <EmployeesAdminView />;
}
