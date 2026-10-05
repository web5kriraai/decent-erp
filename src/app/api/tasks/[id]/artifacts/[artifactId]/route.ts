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
  MACHINE_FORMATS,
} from "@/lib/services/task-machine-output-utils";

const patchSchema = z.object({
  stitchCount: z.number().int().min(0).optional().nullable(),
  machineFormat: z.enum(MACHINE_FORMATS).optional().nullable(),
  sampleQty: z.number().int().min(0).optional().nullable(),
  wastageQty: z.number().int().min(0).optional().nullable(),
  needleCount: z.number().int().min(0).optional().nullable(),
  colorCount: z.number().int().min(0).optional().nullable(),
  hoopSize: z.string().max(40).optional().nullable(),
  softwareName: z.string().max(80).optional().nullable(),
  stitchDensity: z.number().min(0).optional().nullable(),
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
        "Machine / punching metrics can only be recorded on punching or machine sample stages.",
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
        ...(body.needleCount !== undefined ? { needleCount: body.needleCount } : {}),
        ...(body.colorCount !== undefined ? { colorCount: body.colorCount } : {}),
        ...(body.hoopSize !== undefined ? { hoopSize: body.hoopSize } : {}),
        ...(body.softwareName !== undefined ? { softwareName: body.softwareName } : {}),
        ...(body.stitchDensity !== undefined ? { stitchDensity: body.stitchDensity } : {}),
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
