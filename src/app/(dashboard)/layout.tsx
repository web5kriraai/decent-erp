import type { Metadata } from "next";
import { DashboardLayoutClient } from "@/components/layout/DashboardLayoutClient";
import { APP_DEFAULT_DESCRIPTION } from "@/config/page-metadata";

export const metadata: Metadata = {
  description: APP_DEFAULT_DESCRIPTION,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
