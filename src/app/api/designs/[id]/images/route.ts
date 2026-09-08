import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { jsonOk, serializeBigInt, withApiHandler, ApiError } from "@/lib/api-utils";
import { PERMISSIONS } from "@/lib/permissions";
import {
  buildStorageKey,
  uploadObject,
  getPresignedDownloadUrl,
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
