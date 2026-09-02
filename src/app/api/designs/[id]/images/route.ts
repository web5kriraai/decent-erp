import { prisma } from "@/lib/db";
import { writeAuditLog, writeAuditLogDirect } from "@/lib/audit";
import { jsonOk, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildStorageKey,
  uploadObject,
  getPresignedDownloadUrl,
  deleteObject,
  StorageError,
} from "@/lib/storage";
import {
  resolveUploadCategory,
  validateUploadFile,
} from "@/lib/file-upload-policy";

async function listDesignImages(designId: bigint) {
  const images = await prisma.designImage.findMany({
    where: { designId },
    orderBy: [{ isPrimary: "desc" }, { uploadedAtUtc: "desc" }],
  });

  return Promise.all(
    images.map(async (image) => ({
      ...image,
      downloadUrl: await getPresignedDownloadUrl(image.storageKey),
    })),
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(null, async (ctx) => {
    const { id } = await params;
    const images = await listDesignImages(BigInt(id));
    return jsonOk(serializeBigInt(images), ctx.correlationId);
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.TASK_EXECUTE],
    async (ctx) => {
      const { id } = await params;
      const designId = BigInt(id);
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const isPrimary = formData.get("isPrimary") === "true";
      const uploadCategory = formData.get("category")?.toString() ?? null;

      if (!file) throw new ApiError("File is required", 400);

      const category = resolveUploadCategory(uploadCategory, file.name);
      const validation = validateUploadFile(
        { name: file.name, type: file.type || "", size: file.size },
        category,
      );
      if (!validation.ok) {
        throw new ApiError(validation.message, file.size > 50 * 1024 * 1024 ? 413 : 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const storageKey = buildStorageKey(id, file.name);
      try {
        await uploadObject(storageKey, buffer, file.type || "application/octet-stream");
      } catch (error) {
        if (error instanceof StorageError) {
          throw new ApiError(error.message, 503, error.cause);
        }
        throw error;
      }

      const image = await prisma.$transaction(async (tx) => {
        if (isPrimary) {
          await tx.designImage.updateMany({
            where: { designId },
            data: { isPrimary: false },
          });
        }

        const created = await tx.designImage.create({
          data: {
            designId,
            storageKey,
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            fileSize: BigInt(file.size),
            uploadedById: ctx.employeeId,
            isPrimary,
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
    },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(
    [PERMISSIONS.DESIGN_CREATE, PERMISSIONS.TASK_EXECUTE],
    async (ctx) => {
      const { id } = await params;
      const designId = BigInt(id);
      const url = new URL(request.url);
      const imageId = url.searchParams.get("imageId");
      if (!imageId) throw new ApiError("imageId is required", 400);

      const image = await prisma.designImage.findFirst({
        where: { id: BigInt(imageId), designId },
      });
      if (!image) throw new ApiError("Image not found", 404);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.designImage.updateMany({
          where: { designId },
          data: { isPrimary: false },
        });
        return tx.designImage.update({
          where: { id: image.id },
          data: { isPrimary: true },
        });
      });

      await writeAuditLogDirect({
        entityType: "DesignImage",
        entityId: updated.id.toString(),
        action: "SET_PRIMARY",
        userId: ctx.employeeId,
        correlationId: ctx.correlationId,
        after: { isPrimary: true },
      });

      return jsonOk(serializeBigInt(updated), ctx.correlationId);
    },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiHandler(PERMISSIONS.DESIGN_CREATE, async (ctx) => {
    const { id } = await params;
    const url = new URL(request.url);
    const imageId = url.searchParams.get("imageId");
    if (!imageId) throw new ApiError("imageId is required", 400);

    const image = await prisma.designImage.findFirst({
      where: { id: BigInt(imageId), designId: BigInt(id) },
    });
    if (!image) throw new ApiError("Image not found", 404);

    await deleteObject(image.storageKey);
    await prisma.designImage.delete({ where: { id: image.id } });

    return jsonOk({ deleted: true }, ctx.correlationId);
  });
}
