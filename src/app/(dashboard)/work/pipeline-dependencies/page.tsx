import { PipelineDependenciesView } from "@/features/tasks/PipelineDependenciesView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("pipelineDependencies");

export default function PipelineDependenciesPage() {
  return <PipelineDependenciesView />;
}
