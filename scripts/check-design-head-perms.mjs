import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const role = await prisma.role.findUnique({
  where: { code: "DESIGN_HEAD" },
  include: { permissions: { include: { permission: true } } },
});

const emp = await prisma.employee.findUnique({
  where: { email: "designhead@decent-erp.local" },
  include: { role: true },
});

console.log(
  "DESIGN_HEAD permissions:",
  role?.permissions.map((r) => r.permission.code).sort().join(", "),
);
console.log("Has DESIGN_CREATE:", role?.permissions.some((r) => r.permission.code === "DESIGN_CREATE"));
console.log("Employee:", emp?.name, emp?.role.code);

await prisma.$disconnect();
