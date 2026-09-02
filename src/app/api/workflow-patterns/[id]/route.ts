import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { updateWorkflowPattern } from "@/lib/services/workflow-pattern-service";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  versionNo: z.number().int().positive().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const pattern = await updateWorkflowPattern(Number(id), body, ctx.employeeId, ctx.correlationId);
    return jsonOk(serializeBigInt(pattern), ctx.correlationId);
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await params;
    const pattern = await prisma.workflowPattern.findUnique({
      where: { id: Number(id) },
      include: {
        tasks: { orderBy: { sequence: "asc" }, include: { process: true, subProcess: true, defaultRole: true } },
        productType: true,
      },
    });
    if (!pattern) throw new ApiError("Workflow pattern not found", 404);
    return jsonOk(serializeBigInt(pattern), ctx.correlationId);
  });
}
