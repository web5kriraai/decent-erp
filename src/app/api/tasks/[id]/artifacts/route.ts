import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { APP_ERROR_CODES } from "@/lib/errors/app-errors";
import { businessRule } from "@/lib/errors/create-app-error";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import {
  canRecordMachineMetrics,
  hasMachineMetricsInPayload,
} from "@/lib/services/task-machine-output-utils";
import { assertTaskAssignedToEmployee } from "@/lib/services/task-service";
import type { TaskArtifactType } from "@prisma/client";

const MACHINE_FORMATS = ["EMB", "DST", "OTHER"] as const;

const schema = z
  .object({
    artifactType: z.enum(["SKETCH_VERSION", "PUNCHING_FILE", "SAMPLE_OUTPUT"]),
    fileName: z.string().optional(),
    storageKey: z.string().optional(),
    stitchCount: z.number().int().min(0).optional(),
    machineFormat: z.enum(MACHINE_FORMATS).optional(),
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

    await assertTaskAssignedToEmployee(taskId, ctx.employeeId);
    const subProcessCode = (
      await prisma.designTask.findUnique({
        where: { id: taskId },
        select: { subProcess: { select: { code: true } } },
      })
    )?.subProcess.code;

    if (
      hasMachineMetricsInPayload(body) &&
      !canRecordMachineMetrics(subProcessCode, body)
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
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const taskId = BigInt(id);
    await assertTaskAssignedToEmployee(taskId, ctx.employeeId);

    const artifacts = await prisma.taskArtifact.findMany({
      where: { taskId },
      orderBy: { uploadedAtUtc: "desc" },
    });
    return jsonOk(serializeBigInt(artifacts), ctx.correlationId);
  });
}
