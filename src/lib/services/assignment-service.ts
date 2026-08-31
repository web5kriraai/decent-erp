import { prisma } from "@/lib/db";

/** Resolve first active employee for a role (spec §6.2 — RoleId at pattern time, employee at assignment). */
export async function resolveEmployeeForRole(roleId: number): Promise<number | null> {
  const employee = await prisma.employee.findFirst({
    where: { roleId, active: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return employee?.id ?? null;
}

export async function resolveEmployeesForRoles(
  roleIds: number[],
): Promise<Map<number, number | null>> {
  const unique = [...new Set(roleIds)];
  const map = new Map<number, number | null>();
  await Promise.all(
    unique.map(async (roleId) => {
      map.set(roleId, await resolveEmployeeForRole(roleId));
    }),
  );
  return map;
}
