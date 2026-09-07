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
  parseConceptMediaKind,
  validateConceptMedia,
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
      const mediaKind = parseConceptMediaKind(
        formData.get("mediaKind")?.toString(),
      );
      const designComponentIdRaw = formData.get("designComponentId")?.toString();
      const designComponentId = designComponentIdRaw
        ? BigInt(designComponentIdRaw)
        : null;

      if (!file) throw new ApiError("File is required", 400);

      const buffer = Buffer.from(await file.arrayBuffer());
      const validation = validateConceptMedia(
        { name: file.name, type: file.type || "", size: file.size },
        mediaKind,
        buffer,
      );
      if (!validation.ok) {
        throw new ApiError(validation.message, validation.status);
      }

      let contentType =
        file.type && file.type !== "application/octet-stream"
          ? file.type
          : file.type || "application/octet-stream";
      if (mediaKind === "FILE" && (!file.type || file.type === "application/octet-stream")) {
        contentType = "application/octet-stream";
      }

      const storageKey = buildStorageKey(id, file.name);
      try {
        await uploadObject(storageKey, buffer, contentType);
      } catch (error) {
        if (error instanceof StorageError) {
          throw new ApiError(error.message, 503, error.cause);
        }
        throw error;
      }

      const image = await prisma.$transaction(async (tx) => {
        const existingPrimary = await tx.designImage.findFirst({
          where: { designId, isPrimary: true },
          select: { id: true },
        });
        const makePrimary = isPrimary || !existingPrimary;

        if (makePrimary) {
          await tx.designImage.updateMany({
            where: { designId },
            data: { isPrimary: false },
          });
        }

        const created = await tx.designImage.create({
          data: {
            designId,
            designComponentId,
            mediaKind,
            storageKey,
            fileName: file.name,
            contentType,
            fileSize: BigInt(file.size),
            uploadedById: ctx.employeeId,
            isPrimary: makePrimary && mediaKind === "IMAGE",
          },
        });

        await writeAuditLog(tx, {
          entityType: "DesignImage",
          entityId: created.id.toString(),
          action: "UPLOAD",
          userId: ctx.employeeId,
          correlationId: ctx.correlationId,
          after: {
            storageKey,
            fileName: file.name,
            isPrimary: makePrimary,
            mediaKind,
            designComponentId: designComponentId?.toString() ?? null,
          },
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
      if ((image.mediaKind ?? "IMAGE") !== "IMAGE") {
        throw new ApiError("Only images can be set as primary", 400);
      }

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

    await writeAuditLogDirect({
      entityType: "DesignImage",
      entityId: image.id.toString(),
      action: "DELETE",
      userId: ctx.employeeId,
      correlationId: ctx.correlationId,
      before: {
        storageKey: image.storageKey,
        fileName: image.fileName,
        isPrimary: image.isPrimary,
      },
    });

    await deleteObject(image.storageKey);
    await prisma.designImage.delete({ where: { id: image.id } });

    return jsonOk({ deleted: true }, ctx.correlationId);
  });
}
