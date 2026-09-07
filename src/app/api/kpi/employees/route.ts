import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { listEmployeeKpiScores } from "@/lib/services/kpi-service";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const { searchParams } = new URL(request.url);
    const employeeIdRaw = searchParams.get("employeeId");
    const employeeId = employeeIdRaw ? Number(employeeIdRaw) : undefined;

    const result = await listEmployeeKpiScores({
      employeeId:
        employeeId !== undefined && Number.isInteger(employeeId) && employeeId > 0
          ? employeeId
          : undefined,
      limit: Number(searchParams.get("limit") ?? 25),
      offset: Number(searchParams.get("offset") ?? 0),
    });

    return jsonOk(serializeBigInt(result), ctx.correlationId);
  });
}
