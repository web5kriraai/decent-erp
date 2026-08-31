import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET ?? "decent-designs";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

export const s3Client = new S3Client({
  region,
  endpoint: endpoint || undefined,
  forcePathStyle,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin123",
  },
});

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function deleteObject(key: string) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function buildStorageKey(designId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `designs/${designId}/${Date.now()}-${safeName}`;
}
