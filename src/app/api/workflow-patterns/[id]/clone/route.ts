import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { cloneWorkflowPattern } from "@/lib/services/workflow-pattern-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const pattern = await cloneWorkflowPattern(
      Number(id),
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(pattern), ctx.correlationId, 201);
  });
}
