import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { endTask } from "@/lib/services/task-service";

const schema = z.object({
  completionStatus: z.enum(["COMPLETED", "CHECKING"]),
  outputRemark: z.string().min(1),
  attachmentIds: z.array(z.number()).optional(),
  checklist: z
    .array(z.object({ itemId: z.number(), result: z.boolean() }))
    .optional(),
  version: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const task = await endTask(
      BigInt(id),
      ctx.employeeId,
      {
        completionStatus: body.completionStatus,
        outputRemark: body.outputRemark,
        version: body.version,
        attachmentIds: body.attachmentIds,
        checklist: body.checklist,
      },
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
