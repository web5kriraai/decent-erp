import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { completeStageApproval } from "@/lib/services/task-service";

const schema = z.object({
  outputRemark: z.string().min(1),
  version: z.number().int().positive(),
  decision: z.enum(["APPROVED", "REJECT", "CORRECTION_REQUIRED"]).optional(),
  correctionRouteToSubProcessId: z.number().int().positive().optional().nullable(),
  correctionReworkAssigneeEmployeeId: z.number().int().positive().optional().nullable(),
  correctionResponsibleEmployeeId: z.number().int().positive().optional().nullable(),
  correctionType: z
    .enum(["MISTAKE", "IMPROVEMENT", "CUSTOMER_CHANGE", "MACHINE", "MATERIAL", "OTHER"])
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.TASK_EXECUTE, PERMISSIONS.DESIGN_APPROVE],
    async (ctx) => {
      const { id } = await params;
      const body = await parseBody(request, schema);
      const task = await completeStageApproval(
        BigInt(id),
        ctx.employeeId,
        {
          outputRemark: body.outputRemark,
          version: body.version,
          decision: body.decision,
          correctionRouteToSubProcessId: body.correctionRouteToSubProcessId,
          correctionReworkAssigneeEmployeeId: body.correctionReworkAssigneeEmployeeId,
          correctionResponsibleEmployeeId: body.correctionResponsibleEmployeeId,
          correctionType: body.correctionType,
        },
        ctx.correlationId,
        ctx.roleCode,
      );
      return jsonOk(serializeBigInt(task), ctx.correlationId);
    },
  );
}
