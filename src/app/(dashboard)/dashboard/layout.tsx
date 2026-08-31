import { pageMetadata } from "@/config/page-metadata";

export const metadata = pageMetadata("dashboard");

export default function DashboardPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
