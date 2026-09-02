import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { resumeTask } from "@/lib/services/task-service";

const schema = z.object({
  version: z.number().int().nonnegative().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    let version: number | undefined;
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await parseBody(request, schema);
      version = body.version;
    }
    const task = await resumeTask(BigInt(id), ctx.employeeId, ctx.correlationId, version);
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
