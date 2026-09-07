import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  getSubProcessUsage,
  type MasterUsageWarning,
} from "@/lib/services/master-usage-service";
import {
  buildCapabilitiesForWrite,
  subProcessPatchSchema,
  syncColumnFlagsFromCapabilities,
  type SubProcessPatchBody,
} from "@/lib/workflow/stage-capabilities-api";
import { parseStageCapabilities } from "@/lib/workflow/stage-capabilities";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await context.params;
    const subProcessId = Number(id);
    if (!Number.isInteger(subProcessId)) throw new ApiError("Invalid id", 400);
    const body = await parseBody<SubProcessPatchBody>(request, subProcessPatchSchema);
    const existing = await prisma.designSubProcessMaster.findUnique({
      where: { id: subProcessId },
    });
    if (!existing) throw new ApiError("Sub-process not found", 404);

    const deactivating = body.active === false && existing.active === true;
    let warnings: MasterUsageWarning[] = [];
    if (deactivating) {
      warnings = await getSubProcessUsage(subProcessId);
    }

    const existingCaps = parseStageCapabilities(existing.capabilities);
    const capabilities =
      body.capabilities !== undefined ||
      body.isApproval !== undefined ||
      body.isFileRequired !== undefined ||
      body.isCorrectionAllowed !== undefined
        ? buildCapabilitiesForWrite({
            code: existing.code,
            isApproval: body.isApproval ?? existing.isApproval,
            isFileRequired: body.isFileRequired ?? existing.isFileRequired,
            isCorrectionAllowed:
              body.isCorrectionAllowed ?? existing.isCorrectionAllowed,
            capabilities: {
              ...(existingCaps ?? {}),
              ...(body.capabilities ?? {}),
            },
          })
        : undefined;

    if (capabilities?.isApproval && capabilities.approvalSurface === "none") {
      throw new ApiError(
        "Approval stages require an approvalSurface other than none.",
        422,
      );
    }

    const flags = capabilities ? syncColumnFlagsFromCapabilities(capabilities) : {};

    const updated = await prisma.designSubProcessMaster.update({
      where: { id: subProcessId },
      data: {
        name: body.name,
        sequence: body.sequence,
        defaultRoleId: body.defaultRoleId,
        active: body.active,
        ...flags,
        ...(capabilities ? { capabilities } : {}),
      },
    });

    await writeAuditLogDirect({
      entityType: "DesignSubProcessMaster",
      entityId: String(subProcessId),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: updated,
    });

    return jsonOk(
      {
        ...serializeBigInt(updated),
        warnings,
      },
      ctx.correlationId,
    );
  });
}
