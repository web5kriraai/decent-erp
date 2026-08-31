import { ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { ALL_ROLE_CODES, ROLE_CATALOG } from "@/config/roles";
import { ROLE_CODES } from "@/lib/permissions";
import bcrypt from "bcryptjs";

const employeeSelect = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  active: true,
  role: { select: { id: true, code: true, name: true } },
} as const;

export async function listEmployeesForAdmin() {
  return prisma.employee.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: employeeSelect,
  });
}

export async function listRolesForAdmin() {
  const roles = await prisma.role.findMany({
    where: { active: true },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { permissions: true, employees: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    displayName: ROLE_CATALOG[role.code as keyof typeof ROLE_CATALOG]?.displayName ?? role.name,
    permissionCount: role._count.permissions,
    employeeCount: role._count.employees,
  }));
}

export async function suggestNextEmployeeCode() {
  const employees = await prisma.employee.findMany({
    where: { employeeCode: { startsWith: "EMP" } },
    select: { employeeCode: true },
  });

  const numbers = employees
    .map((e) => Number.parseInt(e.employeeCode.replace(/^EMP/i, ""), 10))
    .filter((n) => Number.isFinite(n));

  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `EMP${String(next).padStart(3, "0")}`;
}

async function resolveRole(roleCode: string) {
  if (!ALL_ROLE_CODES.includes(roleCode as (typeof ALL_ROLE_CODES)[number])) {
    throw new ApiError("Invalid role code", 400);
  }

  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new ApiError("Role not found", 404);
  return role;
}

export async function createEmployee(
  input: {
    employeeCode?: string;
    name: string;
    email: string;
    roleCode: string;
    password: string;
  },
) {
  const role = await resolveRole(input.roleCode);
  const employeeCode = input.employeeCode?.trim().toUpperCase() || (await suggestNextEmployeeCode());
  const email = input.email.trim().toLowerCase();

  const existingEmail = await prisma.employee.findUnique({ where: { email } });
  if (existingEmail) throw new ApiError("Email is already in use", 409);

  const existingCode = await prisma.employee.findUnique({ where: { employeeCode } });
  if (existingCode) throw new ApiError("Employee code is already in use", 409);

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.employee.create({
    data: {
      employeeCode,
      name: input.name.trim(),
      email,
      passwordHash,
      roleId: role.id,
      active: true,
    },
    select: employeeSelect,
  });
}

export async function updateEmployee(
  employeeId: number,
  input: {
    name?: string;
    email?: string;
    roleCode?: string;
    active?: boolean;
    password?: string;
  },
  actorEmployeeId: number,
) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new ApiError("Employee not found", 404);

  const isSelf = employee.id === actorEmployeeId;

  if (isSelf && input.active === false) {
    throw new ApiError("You cannot deactivate your own account", 409);
  }

  if (isSelf && input.roleCode && input.roleCode !== ROLE_CODES.ADMIN) {
    throw new ApiError("You cannot remove your own System Admin access", 409);
  }

  const data: {
    name?: string;
    email?: string;
    roleId?: number;
    active?: boolean;
    passwordHash?: string;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    const existing = await prisma.employee.findFirst({
      where: { email, NOT: { id: employeeId } },
    });
    if (existing) throw new ApiError("Email is already in use", 409);
    data.email = email;
  }
  if (input.roleCode !== undefined) {
    const role = await resolveRole(input.roleCode);
    data.roleId = role.id;
  }
  if (input.active !== undefined) data.active = input.active;
  if (input.password) {
    data.passwordHash = await bcrypt.hash(input.password, 12);
  }

  return prisma.employee.update({
    where: { id: employeeId },
    data,
    select: employeeSelect,
  });
}

export async function updateEmployeeRole(
  employeeId: number,
  roleCode: string,
  actorEmployeeId: number,
) {
  return updateEmployee(employeeId, { roleCode }, actorEmployeeId);
}

export async function getRolePermissionMatrix(roleId: number) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: { include: { permission: true } },
    },
  });
  if (!role) throw new ApiError("Role not found", 404);

  const allPermissions = await prisma.permission.findMany({ orderBy: { code: "asc" } });
  const assigned = new Set(role.permissions.map((rp) => rp.permission.code));

  return {
    role: { id: role.id, code: role.code, name: role.name },
    permissions: allPermissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      assigned: assigned.has(p.code),
    })),
  };
}

export async function updateRolePermissions(
  roleId: number,
  permissionCodes: string[],
  actorId: number,
  correlationId: string,
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new ApiError("Role not found", 404);

  if (role.code === ROLE_CODES.ADMIN && !permissionCodes.includes("MASTER_ADMIN")) {
    throw new ApiError("System Admin role must retain MASTER_ADMIN permission", 422);
  }

  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionCodes } },
  });
  if (permissions.length !== permissionCodes.length) {
    throw new ApiError("One or more permission codes are invalid", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    });
  });

  const { writeAuditLogDirect } = await import("@/lib/audit");
  await writeAuditLogDirect({
    entityType: "Role",
    entityId: String(roleId),
    action: "UPDATE_PERMISSIONS",
    userId: actorId,
    correlationId,
    after: { permissionCodes },
  });

  return getRolePermissionMatrix(roleId);
}
