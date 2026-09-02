export type UploadCategory = "PRODUCT_IMAGE" | "SKETCH" | "PUNCHING";

const MB = 1024 * 1024;

export const UPLOAD_MAX_BYTES: Record<UploadCategory, number> = {
  PRODUCT_IMAGE: 10 * MB,
  SKETCH: 25 * MB,
  PUNCHING: 50 * MB,
};

const PRODUCT_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SKETCH_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const PUNCHING_EXTENSIONS = new Set(["emb", "dst", "pdf"]);

export function resolveUploadCategory(
  rawCategory: string | null | undefined,
  fileName: string,
): UploadCategory {
  const normalized = rawCategory?.toUpperCase();
  if (normalized === "SKETCH") return "SKETCH";
  if (normalized === "PUNCHING" || normalized === "PUNCH") return "PUNCHING";
  if (normalized === "PRODUCT_IMAGE") return "PRODUCT_IMAGE";

  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "emb" || ext === "dst") return "PUNCHING";
  if (ext === "pdf") return "SKETCH";
  return "PRODUCT_IMAGE";
}

export function maxBytesForCategory(category: UploadCategory): number {
  return UPLOAD_MAX_BYTES[category];
}

export function validateUploadFile(
  file: { name: string; type: string; size: number },
  category: UploadCategory,
): { ok: true } | { ok: false; message: string } {
  const maxBytes = maxBytesForCategory(category);
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / MB);
    return { ok: false, message: `File exceeds ${limitMb}MB limit for ${category.toLowerCase().replace("_", " ")}` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (category === "PRODUCT_IMAGE") {
    if (!PRODUCT_IMAGE_MIMES.has(file.type)) {
      return { ok: false, message: "Product images must be JPEG, PNG, or WebP" };
    }
    return { ok: true };
  }

  if (category === "SKETCH") {
    if (!SKETCH_MIMES.has(file.type) && !["jpg", "jpeg", "png", "webp", "pdf"].includes(ext)) {
      return { ok: false, message: "Sketch files must be JPEG, PNG, WebP, or PDF" };
    }
    return { ok: true };
  }

  if (!PUNCHING_EXTENSIONS.has(ext) && !SKETCH_MIMES.has(file.type)) {
    return { ok: false, message: "Punching files must be EMB, DST, or PDF" };
  }

  return { ok: true };
}

export function categoryLabel(category: UploadCategory): string {
  switch (category) {
    case "PRODUCT_IMAGE":
      return "product image";
    case "SKETCH":
      return "sketch";
    case "PUNCHING":
      return "punching file";
    default:
      return "file";
  }
}
