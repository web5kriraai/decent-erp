import { TaskDetailView } from "@/features/tasks/TaskDetailView";

type PageProps = { params: Promise<{ designId: string; taskId: string }> };

export default async function DesignTaskDetailPage({ params }: PageProps) {
  const { designId, taskId } = await params;
  return <TaskDetailView taskId={taskId} designId={designId} />;
}
