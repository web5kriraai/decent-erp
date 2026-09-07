import { OpsWorkbenchView } from "@/features/work/OpsWorkbenchView";

export default function PunchingWorkbenchPage() {
  return (
    <OpsWorkbenchView
      title="Punching / Wilcom"
      subtitle="Digitizing jobs with stitch counts and software versions"
      stageCodes={["PUNCH", "PUNCH_CHECK"]}
    />
  );
}
