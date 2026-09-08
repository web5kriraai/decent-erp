import { OpsWorkbenchView } from "@/features/work/OpsWorkbenchView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("workPunching");

export default function PunchingWorkbenchPage() {
  return (
    <OpsWorkbenchView
      title="Punching / Wilcom"
      subtitle="Digitizing jobs with stitch counts and software versions"
      stageCodes={["PUNCH", "PUNCH_CHECK"]}
    />
  );
}
