import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeeTimeReport } from "@/lib/services/time-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.TIME_VIEW_TEAM, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const employeeIdParam = searchParams.get("employeeId");

    const to = toParam ? new Date(toParam) : new Date();
    const from = fromParam
      ? new Date(fromParam)
      : new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

    const employeeId = employeeIdParam ? Number(employeeIdParam) : undefined;

    const report = await getEmployeeTimeReport(from, to, employeeId);
    return jsonOk(serializeBigInt(report), ctx.correlationId);
  });
}
