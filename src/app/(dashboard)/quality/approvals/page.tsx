import { ApprovalsView } from "@/features/quality/ApprovalsView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("approvals");

export default function ApprovalsPage() {
  return <ApprovalsView />;
}
