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

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Approval failed";
}

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.DESIGN_APPROVE, async (ctx) => {
    const body = await parseBody(request, schema);
    const succeeded: Array<{ designId: string; result: unknown }> = [];
    const failed: Array<{ designId: string; error: string }> = [];

    for (const item of body.items) {
      const designId = String(item.designId);
      try {
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
        succeeded.push({ designId, result });
      } catch (err) {
        failed.push({ designId, error: errorMessage(err) });
      }
    }

    return jsonOk(
      serializeBigInt({
        count: succeeded.length,
        failedCount: failed.length,
        results: succeeded.map((s) => s.result),
        failures: failed,
      }),
      ctx.correlationId,
    );
  });
}
