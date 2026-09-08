import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeePerformance } from "@/lib/services/performance-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.KPI_ADMIN, async (ctx) => {
    const { id } = await params;
    const employeeId = Number(id);
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const performance = await getEmployeePerformance(
      employeeId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
    return jsonOk(serializeBigInt(performance), ctx.correlationId);
  });
}
