"use client";

import { useSession } from "next-auth/react";
import { ROLE_CODES } from "@/lib/permissions";
import { DesignKanbanView } from "@/features/designs/DesignKanbanView";
import { ProductionHeadDashboard } from "@/features/dashboard/ProductionHeadDashboard";
import { ManagementDashboard } from "@/features/dashboard/ManagementDashboard";
import { CheckerWorkbench } from "@/features/dashboard/CheckerWorkbench";
import { MachineOperatorWorkbench } from "@/features/dashboard/MachineOperatorWorkbench";
import { ExecutorWorkbench } from "@/features/dashboard/ExecutorWorkbench";
import { CostingTeamDashboard } from "@/features/dashboard/CostingTeamDashboard";

/**
 * Home dashboard by role.
 * Design Head + Admin: Design Workflow Dashboard (kanban).
 * Other roles keep their role workbenches.
 */
export function DailyWorkbench() {
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;

  if (roleCode === ROLE_CODES.DESIGN_HEAD || roleCode === ROLE_CODES.ADMIN) {
    return <DesignKanbanView />;
  }
  if (roleCode === ROLE_CODES.PRODUCTION_HEAD) {
    return <ProductionHeadDashboard />;
  }
  if (roleCode === ROLE_CODES.MANAGEMENT) {
    return <ManagementDashboard />;
  }
  if (roleCode === ROLE_CODES.SAMPLE_CHECKER) {
    return <CheckerWorkbench />;
  }
  if (roleCode === ROLE_CODES.MACHINE_OPERATOR) {
    return <MachineOperatorWorkbench />;
  }
  if (roleCode === ROLE_CODES.COSTING_TEAM) {
    return <CostingTeamDashboard />;
  }

  return <ExecutorWorkbench />;
}
