import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET() {
  return withApiHandler(
    [PERMISSIONS.CORRECTION_RAISE, PERMISSIONS.DESIGN_ASSIGN],
    async (ctx) => {
      const employees = await prisma.employee.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          employeeCode: true,
          role: { select: { code: true, name: true } },
        },
      });
      return jsonOk(employees, ctx.correlationId);
    },
  );
}
