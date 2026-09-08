import { jsonOk, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { isTaskDateMode } from "@/lib/services/task-date-mode";
import { previewWorkflowPattern } from "@/lib/services/workflow-pattern-preview-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await context.params;
    const patternId = Number(id);
    if (!Number.isInteger(patternId) || patternId <= 0) {
      throw new ApiError("Invalid workflow pattern id", 400);
    }

    const { searchParams } = new URL(request.url);
    const rawMode = searchParams.get("taskDateMode") ?? "SEQUENTIAL";
    if (!isTaskDateMode(rawMode)) {
      throw new ApiError("Invalid taskDateMode", 400);
    }
    const priorityRaw = searchParams.get("priority") ?? "MEDIUM";
    const designPriority =
      priorityRaw === "LOW" ||
      priorityRaw === "MEDIUM" ||
      priorityRaw === "HIGH" ||
      priorityRaw === "URGENT"
        ? priorityRaw
        : "MEDIUM";

    const preview = await previewWorkflowPattern(patternId, {
      taskDateMode: rawMode,
      designPriority,
      firstAssigneeId: ctx.employeeId,
    });

    return jsonOk(serializeBigInt(preview), ctx.correlationId);
  });
}
