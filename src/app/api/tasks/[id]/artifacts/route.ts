import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule, notFound } from "@/lib/errors/create-app-error";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  canRecordMachineMetrics,
  hasMachineMetricsInPayload,
} from "@/lib/services/task-machine-output-utils";
import type { TaskArtifactType } from "@prisma/client";

const schema = z
  .object({
    artifactType: z.enum(["SKETCH_VERSION", "PUNCHING_FILE", "SAMPLE_OUTPUT"]),
    fileName: z.string().optional(),
    storageKey: z.string().optional(),
    stitchCount: z.number().int().min(0).optional(),
    machineFormat: z.string().max(32).optional(),
    sampleQty: z.number().int().min(0).optional(),
    wastageQty: z.number().int().min(0).optional(),
  })
  .superRefine((body, ctx) => {
    const hasFile = !!body.storageKey?.trim();
    const hasMetrics =
      body.stitchCount != null ||
      body.sampleQty != null ||
      body.wastageQty != null ||
      !!body.machineFormat?.trim();
    if (!hasFile && !hasMetrics) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a file upload or at least one machine output metric.",
      });
    }
  });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const taskId = BigInt(id);
    const body = await parseBody(request, schema);

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

    const artifact = await prisma.taskArtifact.create({
      data: {
        taskId,
        artifactType: body.artifactType as TaskArtifactType,
        fileName: body.fileName,
        storageKey: body.storageKey,
        stitchCount: body.stitchCount,
        machineFormat: body.machineFormat,
        sampleQty: body.sampleQty,
        wastageQty: body.wastageQty,
        uploadedById: ctx.employeeId,
      },
    });

    await writeAuditLogDirect({
      entityType: "TaskArtifact",
      entityId: artifact.id.toString(),
      action: "CREATE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      after: artifact,
    });

    return jsonOk(serializeBigInt(artifact), ctx.correlationId, 201);
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await params;
    const artifacts = await prisma.taskArtifact.findMany({
      where: { taskId: BigInt(id) },
      orderBy: { uploadedAtUtc: "desc" },
    });
    return jsonOk(serializeBigInt(artifacts), ctx.correlationId);
  });
}
