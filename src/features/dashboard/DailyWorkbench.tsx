"use client";

import { useRef } from "react";
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
 * Design Head + Admin: Design Workflow Dashboard (kanban) - same UI as former Pipeline Board.
 * Other roles keep their role workbenches. DesignHeadDashboard.tsx remains in the repo unused here.
 */
export function DailyWorkbench() {
  const { data: session } = useSession();
  const roleCode = session?.user?.roleCode;
  const lastRoleRef = useRef<string | undefined>(undefined);
  if (roleCode) lastRoleRef.current = roleCode;
  const role = roleCode ?? lastRoleRef.current;

  if (!role) return null;

  if (role === ROLE_CODES.DESIGN_HEAD || role === ROLE_CODES.ADMIN) {
    return <DesignKanbanView />;
  }
  if (role === ROLE_CODES.PRODUCTION_HEAD) {
    return <ProductionHeadDashboard />;
  }
  if (role === ROLE_CODES.MANAGEMENT) {
    return <ManagementDashboard />;
  }
  if (role === ROLE_CODES.SAMPLE_CHECKER) {
    return <CheckerWorkbench />;
  }
  if (role === ROLE_CODES.MACHINE_OPERATOR) {
    return <MachineOperatorWorkbench />;
  }
  if (role === ROLE_CODES.COSTING_TEAM) {
    return <CostingTeamDashboard />;
  }

  return <ExecutorWorkbench />;
}
