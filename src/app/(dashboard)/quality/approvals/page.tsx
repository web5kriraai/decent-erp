import { Suspense } from "react";
import { ApprovalsView } from "@/features/quality/ApprovalsView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("approvals");

export default function ApprovalsPage() {
  return (
    <Suspense fallback={null}>
      <ApprovalsView />
    </Suspense>
  );
}
