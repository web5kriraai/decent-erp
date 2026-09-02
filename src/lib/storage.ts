import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  deleteFromLocal,
  getLocalStorageRoot,
  localDownloadPath,
  uploadToLocal,
} from "@/lib/local-storage";
import { StorageError, type StorageBackend } from "@/lib/storage-types";

export { StorageError } from "@/lib/storage-types";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET ?? "decent-designs";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";
const storageDriver = process.env.STORAGE_DRIVER ?? "auto";

let activeBackend: StorageBackend | null = null;

function isConnectionError(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.length === 0 || error.errors.some(isConnectionError);
  }
  if (error && typeof error === "object") {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
      return true;
    }
    const name = (error as Error).name;
    if (name === "TimeoutError" || name === "NetworkingError") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect/i.test(message);
}

function resolveInitialBackend(): StorageBackend {
  if (storageDriver === "local") return "local";
  if (storageDriver === "s3") return "s3";
  if (!endpoint) return "local";
  return "s3";
}

function getBackend(): StorageBackend {
  if (!activeBackend) {
    activeBackend = resolveInitialBackend();
  }
  return activeBackend;
}

function switchToLocalBackend(reason?: unknown) {
  if (activeBackend !== "local") {
    activeBackend = "local";
    const detail =
      reason instanceof Error
        ? reason.message
        : reason != null
          ? String(reason)
          : "not configured";
    console.warn(
      `[storage] Using local filesystem at ${getLocalStorageRoot()} (${detail}). ` +
        "Start MinIO with `docker compose up minio minio-init -d` for S3 storage.",
    );
  }
}

function assertSafeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new StorageError("Invalid storage key");
  }
}

export const s3Client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin123",
  },
});

async function uploadToS3(key: string, body: Buffer | Uint8Array, contentType: string) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
) {
  assertSafeKey(key);
  const backend = getBackend();

  if (backend === "local") {
    await uploadToLocal(key, body, contentType);
    return key;
  }

  try {
    await uploadToS3(key, body, contentType);
    return key;
  } catch (error) {
    if (storageDriver === "s3" || !isConnectionError(error)) {
      throw new StorageError(
        `Object storage upload failed. Ensure MinIO is running at ${endpoint ?? "S3_ENDPOINT"}.`,
        error,
      );
    }
    switchToLocalBackend(error);
    await uploadToLocal(key, body, contentType);
    return key;
  }
}

async function getS3PresignedDownloadUrl(key: string, expiresIn: number) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 3600) {
  assertSafeKey(key);
  const backend = getBackend();

  if (backend === "local") {
    return localDownloadPath(key);
  }

  try {
    return await getS3PresignedDownloadUrl(key, expiresIn);
  } catch (error) {
    if (storageDriver === "s3" || !isConnectionError(error)) {
      throw new StorageError("Could not create download URL for stored file.", error);
    }
    switchToLocalBackend(error);
    return localDownloadPath(key);
  }
}

async function deleteFromS3(key: string) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function deleteObject(key: string) {
  assertSafeKey(key);
  const backend = getBackend();

  if (backend === "local") {
    await deleteFromLocal(key);
    return;
  }

  try {
    await deleteFromS3(key);
  } catch (error) {
    if (storageDriver === "s3" || !isConnectionError(error)) {
      throw new StorageError("Could not delete stored file.", error);
    }
    switchToLocalBackend(error);
    await deleteFromLocal(key);
  }
}

export function buildStorageKey(designId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `designs/${designId}/${Date.now()}-${safeName}`;
}
