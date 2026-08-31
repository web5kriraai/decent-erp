import { WorkflowPatternsView } from "@/features/admin/WorkflowPatternsView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminWorkflowPatterns");

export default function WorkflowPatternsPage() {
  return <WorkflowPatternsView />;
}
