import { jsonOk, parseBody, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  buildCapabilitiesForWrite,
  subProcessCreateSchema,
  syncColumnFlagsFromCapabilities,
  type SubProcessCreateBody,
} from "@/lib/workflow/stage-capabilities-api";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const processId = Number(id);
    const body = await parseBody<SubProcessCreateBody>(request, subProcessCreateSchema);

    const capabilities = buildCapabilitiesForWrite({
      code: body.code.toUpperCase(),
      isApproval: body.isApproval,
      isFileRequired: body.isFileRequired,
      isCorrectionAllowed: body.isCorrectionAllowed,
      capabilities: body.capabilities,
    });
    const flags = syncColumnFlagsFromCapabilities(capabilities);

    if (capabilities.isApproval && capabilities.approvalSurface === "none") {
      throw new ApiError(
        "Approval stages require an approvalSurface other than none.",
        422,
      );
    }

    const sub = await prisma.designSubProcessMaster.create({
      data: {
        processId,
        code: body.code.toUpperCase(),
        name: body.name,
        sequence: body.sequence,
        defaultRoleId: body.defaultRoleId,
        ...flags,
        capabilities,
      },
    });

    await writeAuditLogDirect({
      entityType: "DesignSubProcessMaster",
      entityId: String(sub.id),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: sub,
    });

    return jsonOk(serializeBigInt(sub), ctx.correlationId, 201);
  });
}
