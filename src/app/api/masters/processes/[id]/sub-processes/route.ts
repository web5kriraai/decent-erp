import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  sequence: z.number().int().positive(),
  defaultRoleId: z.number().int().positive().optional(),
  isApproval: z.boolean().optional(),
  isFileRequired: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.MASTER_ADMIN, async (ctx) => {
    const { id } = await params;
    const processId = Number(id);
    const body = await parseBody(request, schema);

    const sub = await prisma.designSubProcessMaster.create({
      data: {
        processId,
        code: body.code.toUpperCase(),
        name: body.name,
        sequence: body.sequence,
        defaultRoleId: body.defaultRoleId,
        isApproval: body.isApproval ?? false,
        isFileRequired: body.isFileRequired ?? false,
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
