"use client";

import { useSession } from "next-auth/react";
import { ROLE_CODES } from "@/lib/permissions";
import { DesignHeadDashboard } from "@/features/dashboard/DesignHeadDashboard";
import { ProductionHeadDashboard } from "@/features/dashboard/ProductionHeadDashboard";
import { ManagementDashboard } from "@/features/dashboard/ManagementDashboard";
import { ExecutorWorkbench } from "@/features/dashboard/ExecutorWorkbench";

export function DailyWorkbench() {
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;

  if (roleCode === ROLE_CODES.DESIGN_HEAD) {
    return <DesignHeadDashboard />;
  }
  if (roleCode === ROLE_CODES.PRODUCTION_HEAD) {
    return <ProductionHeadDashboard />;
  }
  if (roleCode === ROLE_CODES.MANAGEMENT) {
    return <ManagementDashboard />;
  }

  return <ExecutorWorkbench />;
}
