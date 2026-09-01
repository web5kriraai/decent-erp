import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { updateWorkflowPatternTasks } from "@/lib/services/workflow-pattern-service";

const taskSchema = z.object({
  processId: z.number().int().positive(),
  subProcessId: z.number().int().positive(),
  defaultRoleId: z.number().int().positive(),
  expectedMinutes: z.number().int().positive(),
  sequence: z.number().int().positive(),
  dayOffset: z.number().int().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dependencySequence: z.number().int().positive().nullable().optional(),
});

const patchSchema = z.object({
  tasks: z.array(taskSchema).min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const pattern = await updateWorkflowPatternTasks(
      Number(id),
      body.tasks,
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(pattern), ctx.correlationId);
  });
}
