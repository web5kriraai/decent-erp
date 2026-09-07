import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { requireMasterOfType } from "@/lib/services/master-catalog-service";
import { MASTER_TYPES } from "@/lib/master-catalog-types";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  sampleMachineId: z.number().int().positive().nullable(),
});

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await context.params;
    let taskId: bigint;
    try {
      taskId = BigInt(id);
    } catch {
      throw new ApiError("Invalid task id", 400);
    }
    const body = await parseBody(request, schema);
    if (body.sampleMachineId != null) {
      await requireMasterOfType(body.sampleMachineId, MASTER_TYPES.MACHINE);
    }
    const updated = await prisma.designTask.update({
      where: { id: taskId },
      data: { sampleMachineId: body.sampleMachineId },
      include: { sampleMachine: true },
    });
    return jsonOk(serializeBigInt(updated), ctx.correlationId);
  });
}
