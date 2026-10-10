import { STORED_FILE_MAX_BYTES } from "@/lib/file-upload-policy";

/** Stored product photos stay at or under the shared file cap. */
export const STORED_IMAGE_MAX_BYTES = STORED_FILE_MAX_BYTES;

export type CompressImageResult =
  | { ok: true; file: File }
  | { ok: false; code: "CANNOT_COMPRESS"; bytes: number };

/**
 * Shrink a product photo in the browser, then return a JPEG at or under 500 KB.
 * PNG and WebP are stored as JPEG, so transparency is flattened to white.
 * When the image is still over 500 KB after the last attempt, this reports
 * CANNOT_COMPRESS instead of returning the oversized file.
 * Non-images are returned unchanged.
 */
export async function compressImageForStorage(file: File): Promise<CompressImageResult> {
  if (!file.type.startsWith("image/")) return { ok: true, file };
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return { ok: true, file };
  }
  if (file.size <= STORED_IMAGE_MAX_BYTES && file.type === "image/jpeg") {
    return { ok: true, file };
  }

  const bitmap = await createImageBitmap(file);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const longest = Math.max(width, height);
    if (longest > 1600) {
      const scale = 1600 / longest;
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: true, file };

    let quality = 0.82;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
      });
      if (blob && blob.size <= STORED_IMAGE_MAX_BYTES) break;
      if (quality > 0.45) quality = Math.round((quality - 0.1) * 100) / 100;
      else {
        width = Math.max(1, Math.round(width * 0.8));
        height = Math.max(1, Math.round(height * 0.8));
      }
    }

    if (!blob || blob.size > STORED_IMAGE_MAX_BYTES) {
      return { ok: false, code: "CANNOT_COMPRESS", bytes: blob?.size ?? file.size };
    }
    if (blob.size >= file.size && file.size <= STORED_IMAGE_MAX_BYTES) {
      return { ok: true, file };
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return {
      ok: true,
      file: new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() }),
    };
  } finally {
    bitmap.close();
  }
}
