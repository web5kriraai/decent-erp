import { jsonOk, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getWorkflowPatternUsage } from "@/lib/services/workflow-pattern-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const patternId = Number(id);
    if (!Number.isInteger(patternId) || patternId <= 0) {
      throw new ApiError("Invalid workflow pattern id", 400);
    }

    const pattern = await prisma.workflowPattern.findUnique({
      where: { id: patternId },
      select: { id: true },
    });
    if (!pattern) throw new ApiError("Workflow pattern not found", 404);

    const usage = await getWorkflowPatternUsage(patternId);
    return jsonOk(usage, ctx.correlationId);
  });
}
