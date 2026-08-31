import { DesignKanbanView } from "@/features/designs/DesignKanbanView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("designsKanban");

export default function DesignKanbanPage() {
  return <DesignKanbanView />;
}
