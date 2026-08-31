import { TaskDetailView } from "@/features/tasks/TaskDetailView";

type PageProps = { params: Promise<{ designId: string; taskId: string }> };

export default async function DesignTaskDetailPage({ params }: PageProps) {
  const { taskId } = await params;
  return <TaskDetailView taskId={taskId} />;
}
