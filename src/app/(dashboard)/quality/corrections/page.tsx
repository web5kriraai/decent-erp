import { CorrectionsView } from "@/features/quality/CorrectionsView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("corrections");

export default function CorrectionsPage() {
  return <CorrectionsView />;
}
