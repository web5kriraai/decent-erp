import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { createCorrection } from "@/lib/services/correction-service";

const schema = z.object({
  designId: z.string(),
  taskId: z.string(),
  correctionType: z.enum([
    "MISTAKE",
    "IMPROVEMENT",
    "CUSTOMER_CHANGE",
    "MACHINE_MATERIAL_ISSUE",
  ]),
  responsibleEmployeeId: z.number().int().positive(),
  rootCause: z.string().optional(),
  extraMinutes: z.number().int().optional(),
  extraCost: z.number().optional(),
});

export async function POST(request: Request) {
  return withApiHandler(PERMISSIONS.CORRECTION_RAISE, async (ctx) => {
    const body = await parseBody(request, schema);
    const correction = await createCorrection(
      {
        designId: BigInt(body.designId),
        taskId: BigInt(body.taskId),
        correctionType: body.correctionType,
        responsibleEmployeeId: body.responsibleEmployeeId,
        rootCause: body.rootCause,
        extraMinutes: body.extraMinutes,
        extraCost: body.extraCost,
      },
      ctx.employeeId,
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(correction), ctx.correlationId, 201);
  });
}
