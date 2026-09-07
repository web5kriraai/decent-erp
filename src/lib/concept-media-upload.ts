import type { ConceptMediaKind } from "@/lib/file-upload-policy";
import {
  limitLabelForMediaKind,
  validateConceptMediaClient,
} from "@/lib/file-upload-policy";
import { ApiClientError } from "@/lib/api-client";

export type PendingConceptMedia = {
  id: string;
  file: File;
  mediaKind: ConceptMediaKind;
  /** Only meaningful for IMAGE. */
  isPrimary?: boolean;
  /** Object URL for local preview (revoke when removed). */
  previewUrl?: string;
};

export type ConceptMediaUploadProgress = {
  index: number;
  total: number;
  fileName: string;
  mediaKind: ConceptMediaKind;
  status: "uploading" | "done" | "error";
  error?: string;
};

export async function uploadConceptMediaFile(options: {
  designId: string;
  file: File;
  mediaKind: ConceptMediaKind;
  isPrimary?: boolean;
  designComponentId?: string | null;
}): Promise<unknown> {
  const {
    designId,
    file,
    mediaKind,
    isPrimary = false,
    designComponentId = null,
  } = options;

  const preflight = validateConceptMediaClient(file, mediaKind);
  if (!preflight.ok) {
    throw new ApiClientError(
      preflight.message,
      preflight.status,
      undefined,
      undefined,
      undefined,
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("mediaKind", mediaKind);
  if (mediaKind === "IMAGE") {
    formData.append("category", "PRODUCT_IMAGE");
  }
  if (isPrimary && mediaKind === "IMAGE") {
    formData.append("isPrimary", "true");
  }
  if (designComponentId) {
    formData.append("designComponentId", designComponentId);
  }

  const res = await fetch(`/api/designs/${designId}/images`, {
    method: "POST",
    body: formData,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(
      typeof json.error === "string"
        ? json.error
        : res.status === 413
          ? `File exceeds ${limitLabelForMediaKind(mediaKind)} limit`
          : "Upload failed",
      res.status,
      json.correlationId,
      json.details,
      json.code,
    );
  }
  return json.data ?? json;
}

export async function uploadPendingConceptMedia(options: {
  designId: string;
  items: PendingConceptMedia[];
  onProgress?: (progress: ConceptMediaUploadProgress) => void;
}): Promise<{ uploaded: number; failed: ConceptMediaUploadProgress[] }> {
  const { designId, items, onProgress } = options;
  let uploaded = 0;
  const failed: ConceptMediaUploadProgress[] = [];
  const total = items.length;

  // Prefer the first image marked primary; otherwise first IMAGE in queue.
  const primaryId =
    items.find((i) => i.mediaKind === "IMAGE" && i.isPrimary)?.id ??
    items.find((i) => i.mediaKind === "IMAGE")?.id;

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    onProgress?.({
      index,
      total,
      fileName: item.file.name,
      mediaKind: item.mediaKind,
      status: "uploading",
    });
    try {
      await uploadConceptMediaFile({
        designId,
        file: item.file,
        mediaKind: item.mediaKind,
        isPrimary: item.id === primaryId,
      });
      uploaded += 1;
      onProgress?.({
        index,
        total,
        fileName: item.file.name,
        mediaKind: item.mediaKind,
        status: "done",
      });
    } catch (error) {
      const message =
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Upload failed";
      const entry: ConceptMediaUploadProgress = {
        index,
        total,
        fileName: item.file.name,
        mediaKind: item.mediaKind,
        status: "error",
        error: message,
      };
      failed.push(entry);
      onProgress?.(entry);
    }
  }

  return { uploaded, failed };
}

export function createPendingMediaId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function inferMediaKindFromFile(file: File): ConceptMediaKind {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (type.startsWith("image/")) return "IMAGE";
  if (type.startsWith("video/")) return "VIDEO";
  if (type.startsWith("audio/")) return "AUDIO";
  if (/\.(jpe?g|png|webp)$/i.test(name)) return "IMAGE";
  if (/\.(mp4|mov|webm)$/i.test(name)) return "VIDEO";
  if (/\.(mp3|wav|m4a|ogg)$/i.test(name)) return "AUDIO";
  return "FILE";
}
