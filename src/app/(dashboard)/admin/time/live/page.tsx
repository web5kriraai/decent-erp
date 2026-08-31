import { AdminTimeLiveView } from "@/features/time/AdminTimeLiveView";
import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("adminTimeLive");

export default function AdminTimeLivePage() {
  return <AdminTimeLiveView />;
}
