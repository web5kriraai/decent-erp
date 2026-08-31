import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { createManualTask } from "@/lib/services/task-service";

const schema = z.object({
  designId: z.string(),
  processId: z.number().int(),
  subProcessId: z.number().int(),
  assignedEmployeeId: z.number().int().optional(),
  assignedRoleId: z.number().int(),
  expectedMinutes: z.number().int().positive(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_ASSIGN, async (ctx) => {
    const body = await parseBody(request, schema);
    const task = await createManualTask(
      {
        designId: BigInt(body.designId),
        processId: body.processId,
        subProcessId: body.subProcessId,
        assignedEmployeeId: body.assignedEmployeeId,
        assignedRoleId: body.assignedRoleId,
        expectedMinutes: body.expectedMinutes,
        priority: body.priority,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId, 201);
  });
}
