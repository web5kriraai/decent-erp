import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { endTask } from "@/lib/services/task-service";

const schema = z.object({
  completionStatus: z.enum(["COMPLETED", "CHECKING"]),
  outputRemark: z.string().min(1),
  attachmentIds: z.array(z.number()).optional(),
  checklist: z
    .array(
      z.object({
        itemId: z.number(),
        result: z.boolean(),
        remark: z.string().optional(),
      }),
    )
    .optional(),
  checklistNote: z.string().optional(),
  sampleOutcome: z.enum(["APPROVE", "PASS", "HOLD", "REJECT", "RESAMPLE"]).optional(),
  /** When sampleOutcome=REJECT: optional override for correction routing. */
  correctionRouteToSubProcessId: z.number().int().positive().optional().nullable(),
  correctionReworkAssigneeEmployeeId: z.number().int().positive().optional().nullable(),
  correctionResponsibleEmployeeId: z.number().int().positive().optional().nullable(),
  correctionType: z
    .enum(["MISTAKE", "IMPROVEMENT", "CUSTOMER_CHANGE", "MACHINE", "MATERIAL", "OTHER"])
    .optional(),
  costEntries: z
    .array(
      z.object({
        costType: z.enum(["TIME", "MATERIAL", "MACHINE", "CORRECTION"]),
        description: z.string().optional(),
        amount: z.number().positive(),
      }),
    )
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
        checklistNote: body.checklistNote,
        sampleOutcome: body.sampleOutcome,
        correctionRouteToSubProcessId: body.correctionRouteToSubProcessId,
        correctionReworkAssigneeEmployeeId: body.correctionReworkAssigneeEmployeeId,
        correctionResponsibleEmployeeId: body.correctionResponsibleEmployeeId,
        correctionType: body.correctionType,
        costEntries: body.costEntries,
      },
      ctx.correlationId,
    );
    return jsonOk(serializeBigInt(task), ctx.correlationId);
  });
}
