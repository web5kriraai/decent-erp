import { z } from "zod";
import { jsonOk, parseBody, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { writeAuditLogDirect } from "@/lib/audit";
import type { TaskArtifactType } from "@prisma/client";

const schema = z.object({
  artifactType: z.enum(["SKETCH_VERSION", "PUNCHING_FILE", "SAMPLE_OUTPUT", "AUDIO_NOTE", "VIDEO_REF"]),
  versionNo: z.number().int().positive().optional(),
  fileName: z.string().optional(),
  storageKey: z.string().optional(),
  stitchCount: z.number().int().optional(),
  machineFormat: z.string().optional(),
  sampleQty: z.number().int().optional(),
  wastageQty: z.number().int().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const { id } = await params;
    const taskId = BigInt(id);
    const body = await parseBody(request, schema);

    const artifact = await prisma.taskArtifact.create({
      data: {
        taskId,
        artifactType: body.artifactType as TaskArtifactType,
        versionNo: body.versionNo,
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
