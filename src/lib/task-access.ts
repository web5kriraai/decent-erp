import { PERMISSIONS } from "@/lib/permissions";

export type WorkTaskAccess = "ok" | "hidden" | "forbidden" | "not-assigned";

/**
 * Work-task page access. Identity is the token employee, company, and permissions.
 * Team-time and admin oversight do not open another person's task.
 */
export function decideWorkTaskAccess(input: {
  permissions: string[];
  employeeId: number;
  companyId: number;
  taskCompanyId: number;
  assignedEmployeeId: number | null;
}): WorkTaskAccess {
  if (input.taskCompanyId !== input.companyId) return "hidden";
  if (!input.permissions.includes(PERMISSIONS.TASK_EXECUTE)) return "forbidden";
  const assigneeId = input.assignedEmployeeId;
  if (assigneeId == null || Number(assigneeId) !== Number(input.employeeId)) {
    return "not-assigned";
  }
  return "ok";
}
