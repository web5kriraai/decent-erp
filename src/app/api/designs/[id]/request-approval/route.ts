import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { requestDesignApproval } from "@/lib/services/approval-service";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  requesterRemark: z.string().min(8, "Requester remark must be at least 8 characters"),
  summaryNote: z.string().max(2000).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new ApiError("Invalid design id", 400);
    const body = await parseBody(request, schema);
    const design = await requestDesignApproval(BigInt(id), ctx.employeeId, ctx.correlationId, {
      requesterRemark: body.requesterRemark,
      summaryNote: body.summaryNote,
    });
    return jsonOk(serializeBigInt(design), ctx.correlationId);
  });
}
