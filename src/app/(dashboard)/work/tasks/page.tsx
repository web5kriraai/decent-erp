import { TaskWorkspace } from "@/features/tasks/TaskWorkspace";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("workTasks");

export default function WorkTasksPage() {
  return <TaskWorkspace />;
}
