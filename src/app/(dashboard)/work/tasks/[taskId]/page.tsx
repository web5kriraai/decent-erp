import { TaskDetailView } from "@/features/tasks/TaskDetailView";

type PageProps = { params: Promise<{ taskId: string }> };

export default async function WorkTaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
