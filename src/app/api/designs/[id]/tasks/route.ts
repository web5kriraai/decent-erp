import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateDesignTaskSchedule } from "@/lib/services/design-service";

const schema = z.object({
  tasks: z
    .array(
      z.object({
        taskId: z.string().min(1),
        dueAt: z.string().nullable().optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        assignedEmployeeId: z.number().int().nullable().optional(),
        expectedMinutes: z.number().int().positive().optional(),
      }),
    )
    .min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const result = await updateDesignTaskSchedule(
      BigInt(id),
      body.tasks,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(result), ctx.correlationId);
  });
}
