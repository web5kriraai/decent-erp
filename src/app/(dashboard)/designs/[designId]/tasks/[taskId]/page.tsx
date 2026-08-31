import { TaskDetailView } from "@/features/tasks/TaskDetailView";
import { designTaskMetadata } from "@/config/page-metadata";

type PageProps = { params: Promise<{ designId: string; taskId: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { designId, taskId } = await params;
  return designTaskMetadata(designId, taskId);
}

export default async function DesignTaskDetailPage({ params }: PageProps) {
  const { designId, taskId } = await params;
  return <TaskDetailView taskId={taskId} designId={designId} />;
}
