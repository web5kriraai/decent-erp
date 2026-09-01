import { z } from "zod";
import {
  jsonOk,
  parseBody,
  serializeBigInt,
  withApiHandler,
} from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { getDesignById } from "@/lib/services/design-service";
import { bypassDesignToPhase } from "@/lib/services/workflow-override-service";

const bodySchema = z.object({
  targetTaskId: z.string().min(1),
  reason: z.string().min(10),
  assigneeId: z.number().int().positive().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.WORKFLOW_OVERRIDE, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, bodySchema);

    await bypassDesignToPhase(
      BigInt(id),
      BigInt(body.targetTaskId),
      body.reason,
      ctx.employeeId,
      ctx.correlationId,
      body.assigneeId,
    );

    const design = await getDesignById(BigInt(id), { viewerEmployeeId: ctx.employeeId });
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
