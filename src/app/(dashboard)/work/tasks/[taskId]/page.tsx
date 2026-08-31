import { TaskDetailView } from "@/features/tasks/TaskDetailView";
import { workTaskMetadata } from "@/config/page-metadata";

type PageProps = { params: Promise<{ taskId: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { taskId } = await params;
  return workTaskMetadata(taskId);
}

export default async function WorkTaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
