import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule, notFound } from "@/lib/errors/create-app-error";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { assertTaskAssignedToEmployee } from "@/lib/services/task-service";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  canRecordMachineMetrics,
  hasMachineMetricsInPayload,
} from "@/lib/services/task-machine-output-utils";

const patchSchema = z.object({
  stitchCount: z.number().int().min(0).optional().nullable(),
  machineFormat: z.string().max(32).optional().nullable(),
  sampleQty: z.number().int().min(0).optional().nullable(),
  wastageQty: z.number().int().min(0).optional().nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; artifactId: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id, artifactId } = await params;
    const taskId = BigInt(id);
    const body = await parseBody(request, patchSchema);

    await assertTaskAssignedToEmployee(taskId, ctx.employeeId);

    const task = await prisma.designTask.findUnique({
      where: { id: taskId },
      select: { subProcess: { select: { code: true } } },
    });
    if (!task) throw notFound(APP_ERROR_CODES.TASK_NOT_FOUND);

    if (
      hasMachineMetricsInPayload(body) &&
      !canRecordMachineMetrics(task.subProcess.code, body)
    ) {
      throw businessRule(
        APP_ERROR_CODES.VALIDATION_FAILED,
        undefined,
        "Machine output metrics can only be recorded on machine sample, receive, or re-sample tasks.",
      );
    }

    const existing = await prisma.taskArtifact.findFirst({
      where: { id: BigInt(artifactId), taskId },
    });
    if (!existing) {
      throw notFound(APP_ERROR_CODES.NOT_FOUND);
    }

    const artifact = await prisma.taskArtifact.update({
      where: { id: existing.id },
      data: {
        ...(body.stitchCount !== undefined ? { stitchCount: body.stitchCount } : {}),
        ...(body.machineFormat !== undefined ? { machineFormat: body.machineFormat } : {}),
        ...(body.sampleQty !== undefined ? { sampleQty: body.sampleQty } : {}),
        ...(body.wastageQty !== undefined ? { wastageQty: body.wastageQty } : {}),
      },
    });

    await writeAuditLogDirect({
      entityType: "TaskArtifact",
      entityId: artifact.id.toString(),
      action: "UPDATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: existing,
      after: artifact,
    });

    return jsonOk(serializeBigInt(artifact), ctx.correlationId);
  });
}
