import { OpsWorkbenchView } from "@/features/work/OpsWorkbenchView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("workSketch");

export default function SketchWorkbenchPage() {
  return (
    <OpsWorkbenchView
      title="Sketch Management"
      subtitle="Sketch creation and revision queue"
      stageCodes={["SKETCH", "SKETCH_APPROVAL"]}
    />
  );
}
