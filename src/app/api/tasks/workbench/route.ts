import { prisma } from "@/lib/db";
import { jsonOk, serializeBigInt, withApiHandler } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(request: Request) {
  return withApiHandler(PERMISSIONS.TASK_EXECUTE, async (ctx) => {
    const stagesParam = new URL(request.url).searchParams.get("stages") ?? "";
    const codes = stagesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const tasks = await prisma.designTask.findMany({
      where: {
        status: { notIn: ["CANCELLED", "SKIPPED"] },
        ...(codes.length
          ? { subProcess: { code: { in: codes } } }
          : {}),
      },
      include: {
        design: { select: { id: true, ideaRef: true, collectionName: true } },
        subProcess: { select: { id: true, code: true, name: true } },
        assignedEmployee: { select: { id: true, name: true } },
        sampleMachine: { select: { id: true, code: true, name: true } },
        artifacts: {
          orderBy: { id: "desc" },
          take: 3,
          select: { artifactType: true, metadata: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { id: "desc" }],
      take: 200,
    });

    return jsonOk(serializeBigInt(tasks), ctx.correlationId);
  });
}
