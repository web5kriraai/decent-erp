import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { submitApproval } from "@/lib/services/approval-service";

const schema = z.object({
  items: z
    .array(
      z.object({
        designId: z.union([z.string(), z.number()]),
        taskId: z.union([z.string(), z.number()]).optional(),
        approvalLevelId: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(50),
  decision: z.enum(["APPROVED", "REJECTED"]),
  remark: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const body = await parseBody(request, schema);
    const results = [];
    for (const item of body.items) {
      const result = await submitApproval(
        {
          designId: BigInt(item.designId),
          taskId: item.taskId != null ? BigInt(item.taskId) : undefined,
          approvalLevelId: item.approvalLevelId,
          decision: body.decision,
          remark: body.remark,
        },
        ctx.employeeId,
        ctx.correlationId,
      );
      results.push(result);
    }
    return jsonOk(serializeBigInt({ count: results.length, results }), ctx.correlationId);
  });
}
