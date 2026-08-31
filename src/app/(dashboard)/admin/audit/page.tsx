import { AuditLogView } from "@/features/admin/AuditLogView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminAudit");

export default function AuditLogPage() {
  return <AuditLogView />;
}
