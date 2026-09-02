import { prisma } from "@/lib/db";

async function loadRolePermissions(roleId: number): Promise<string[]> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rolePermissions.map((rp) => rp.permission.code);
}

/** Node-only: reload permissions from DB (API routes, not Auth.js edge callbacks). */
export async function loadEmployeeSessionPermissions(employeeId: number): Promise<{
  permissions: string[];
  roleCode: string | null;
}> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { role: true },
  });
  if (!employee?.active) {
    return { permissions: [], roleCode: null };
  }
  const permissions = await loadRolePermissions(employee.roleId);
  return { permissions, roleCode: employee.role.code };
}
