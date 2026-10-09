import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { hasAssignManualPermission, PERMISSIONS } from "@/lib/permissions";
import { assignTask } from "@/lib/services/task-service";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  employeeId: z.number().int().positive(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(null, async (ctx) => {
    if (
      !hasAssignManualPermission(ctx.permissions) &&
      !ctx.permissions.includes(PERMISSIONS.DESIGN_REASSIGN)
    ) {
      throw new ApiError("You do not have permission to assign tasks", 403);
    }
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid task id", 400);
    const body = await parseBody(request, schema);
    const task = await assignTask(
      BigInt(id),
      body.employeeId,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
