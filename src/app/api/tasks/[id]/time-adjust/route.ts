import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { adminAdjustTaskTime } from "@/lib/services/task-service";

const schema = z.object({
  remark: z.string().min(1),
  adjustActiveSeconds: z.number().int(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, schema);
    const event = await adminAdjustTaskTime(
      BigInt(id),
      ctx.employeeId,
      body.remark,
      body.adjustActiveSeconds,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(event), ctx.correlationId, 201);
  });
}
