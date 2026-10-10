import { compressImageForStorage } from "@/lib/compress-image-client";
import {
  formatBytes,
  isCompressibleType,
  STORED_FILE_MAX_BYTES,
  validateConceptMedia,
  validateUploadFile,
  type ConceptMediaKind,
  type UploadCategory,
  type UploadValidationResult,
} from "@/lib/file-upload-policy";

export type PrepareUploadCode =
  | "TOO_LARGE"
  | "CANNOT_COMPRESS"
  | "UNSUPPORTED_TYPE"
  | "EMPTY";

export type PrepareUploadResult =
  | { ok: true; file: File }
  | {
      ok: false;
      code: PrepareUploadCode;
      message: string;
      status: 400 | 413;
      maxBytes?: number;
      actualBytes?: number;
    };

export type PrepareUploadTarget =
  | { category: UploadCategory }
  | { mediaKind: ConceptMediaKind };

function fromValidation(
  result: Extract<UploadValidationResult, { ok: false }>,
): PrepareUploadResult {
  return {
    ok: false,
    code: result.code,
    message: result.message,
    status: result.status,
    maxBytes: result.maxBytes,
    actualBytes: result.actualBytes,
  };
}

/**
 * Compress images first, then check type and the stored size limit.
 * Non-images are never rewritten; they are rejected when over the cap.
 */
export async function prepareUploadFile(
  file: File,
  target: PrepareUploadTarget,
): Promise<PrepareUploadResult> {
  if (file.size <= 0) {
    const name = file.name?.trim() || "This file";
    return {
      ok: false,
      code: "EMPTY",
      status: 400,
      message: `${name} is empty. Choose a file with content.`,
    };
  }

  const typeCheck = validateTarget(
    { name: file.name, type: file.type || "", size: 1 },
    target,
  );
  if (!typeCheck.ok) return fromValidation(typeCheck);

  let prepared = file;
  if (isCompressibleType(file.type)) {
    const compressed = await compressImageForStorage(file);
    if (!compressed.ok) {
      return {
        ok: false,
        code: "CANNOT_COMPRESS",
        status: 413,
        maxBytes: STORED_FILE_MAX_BYTES,
        actualBytes: compressed.bytes,
        message: `${file.name} is still ${formatBytes(compressed.bytes)} after compression. Maximum allowed is ${formatBytes(STORED_FILE_MAX_BYTES)}. Use a smaller image and try again.`,
      };
    }
    prepared = compressed.file;
  }

  const sizeCheck = validateTarget(
    { name: prepared.name, type: prepared.type || "", size: prepared.size },
    target,
  );
  if (!sizeCheck.ok) return fromValidation(sizeCheck);
  return { ok: true, file: prepared };
}

function validateTarget(
  file: { name: string; type: string; size: number },
  target: PrepareUploadTarget,
): UploadValidationResult {
  if ("category" in target) return validateUploadFile(file, target.category);
  return validateConceptMedia(file, target.mediaKind);
}

export function prepareErrorTitle(code: PrepareUploadCode): string {
  if (code === "TOO_LARGE" || code === "CANNOT_COMPRESS") return "File too large";
  if (code === "EMPTY") return "Empty file";
  return "Invalid file";
}
