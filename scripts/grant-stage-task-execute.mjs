/**
 * Grants TASK_EXECUTE to Design Head + Costing Team (existing DBs that predate the permission fix).
 * Run: npx tsx scripts/grant-stage-task-execute.mjs
 */
import { PrismaClient } from "@prisma/client";

const ROLE_CODES = ["DESIGN_HEAD", "COSTING_TEAM"];
const PERM = "TASK_EXECUTE";

const prisma = new PrismaClient();
try {
  const permission = await prisma.permission.upsert({
    where: { code: PERM },
    update: {},
    create: { code: PERM, name: "Task Execute" },
  });

  for (const code of ROLE_CODES) {
    const role = await prisma.role.findUnique({ where: { code } });
    if (!role) {
      console.warn(`Role ${code} not found — skip`);
      continue;
    }
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: permission.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
    console.log(`Granted ${PERM} → ${code}`);
  }
} finally {
  await prisma.$disconnect();
}
