import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { requireMasterOfType } from "@/lib/services/master-catalog-service";
import { MASTER_TYPES } from "@/lib/master-catalog-types";
import { assertTaskAssignedToEmployee } from "@/lib/services/task-service";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { notFound } from "@/lib/errors/create-app-error";

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
    const existing = await prisma.designTask.findUnique({
      where: { id: taskId },
      select: { design: { select: { companyId: true } } },
    });
    if (!existing || existing.design.companyId !== ctx.companyId) {
      throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);
    }
    await assertTaskAssignedToEmployee(taskId, ctx.employeeId);
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
