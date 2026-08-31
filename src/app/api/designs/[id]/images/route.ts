import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { jsonOk, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import { buildStorageKey, uploadObject, getPresignedDownloadUrl } from "@/lib/storage";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await params;
    const designId = BigInt(id);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) throw new ApiError("File is required", 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = buildStorageKey(id, file.name);
    await uploadObject(storageKey, buffer, file.type);

    const image = await prisma.$transaction(async (tx) => {
      const created = await tx.designImage.create({
        data: {
          designId,
          storageKey,
          fileName: file.name,
          contentType: file.type,
          fileSize: BigInt(file.size),
          uploadedById: ctx.employeeId,
        },
      });

      await writeAuditLog(tx, {
        entityType: "DesignImage",
        entityId: created.id.toString(),
        action: "UPLOAD",
        userId: ctx.employeeId,
        correlationId: ctx.correlationId,
        after: { storageKey, fileName: file.name },
      });

      return created;
    });

    const downloadUrl = await getPresignedDownloadUrl(storageKey);
    return jsonOk(
      serializeBigInt({ ...image, downloadUrl }),
      ctx.correlationId,
      201,
    );
  });
}
