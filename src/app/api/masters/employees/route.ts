import { jsonOk, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  return withApiHandler(
    [PERMISSIONS.CORRECTION_RAISE, PERMISSIONS.DESIGN_ASSIGN, PERMISSIONS.DESIGN_CREATE],
    async (ctx) => {
      const roleCode = new URL(request.url).searchParams.get("roleCode")?.trim() || undefined;
      const employees = await prisma.employee.findMany({
        where: {
          active: true,
          ...(roleCode ? { role: { code: roleCode } } : {}),
        },
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
