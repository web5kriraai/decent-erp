import { OpsWorkbenchView } from "@/features/work/OpsWorkbenchView";

export default function SketchWorkbenchPage() {
  return (
    <OpsWorkbenchView
      title="Sketch Management"
      subtitle="Sketch creation and revision queue"
      stageCodes={["SKETCH", "SKETCH_APPROVAL"]}
    />
  );
}
