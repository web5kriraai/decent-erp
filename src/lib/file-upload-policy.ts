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
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const SKETCH_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

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

export function limitLabelForCategory(category: UploadCategory): string {
  return `${Math.round(maxBytesForCategory(category) / MB)}MB`;
}

export function categoryLabel(category: UploadCategory): string {
  return category.toLowerCase().replaceAll("_", " ");
}

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isLooseBinaryMime(type: string): boolean {
  return !type || type === "application/octet-stream";
}

export type UploadValidationResult =
  | { ok: true }
  | { ok: false; message: string; status: 400 | 413 };

export function validateUploadFile(
  file: { name: string; type: string; size: number },
  category: UploadCategory,
): UploadValidationResult {
  const maxBytes = maxBytesForCategory(category);
  if (file.size > maxBytes) {
    return {
      ok: false,
      status: 413,
      message: `File exceeds ${limitLabelForCategory(category)} limit for ${categoryLabel(category)}`,
    };
  }

  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();

  if (category === "PRODUCT_IMAGE") {
    if (isLooseBinaryMime(mime) || !PRODUCT_IMAGE_MIMES.has(mime)) {
      return {
        ok: false,
        status: 400,
        message: "Product images must be JPEG, PNG, or WebP",
      };
    }
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return {
        ok: false,
        status: 400,
        message: "Product images must use a .jpg, .jpeg, .png, or .webp extension",
      };
    }
    return { ok: true };
  }

  if (category === "SKETCH") {
    const mimeOk = SKETCH_MIMES.has(mime);
    const extOk = SKETCH_EXTENSIONS.has(ext);
    if (isLooseBinaryMime(mime)) {
      return {
        ok: false,
        status: 400,
        message: "Sketch files must be JPEG, PNG, WebP, or PDF (MIME type required)",
      };
    }
    if (!mimeOk && !extOk) {
      return {
        ok: false,
        status: 400,
        message: "Sketch files must be JPEG, PNG, WebP, or PDF",
      };
    }
    if (!extOk) {
      return {
        ok: false,
        status: 400,
        message: "Sketch files must use a .jpg, .jpeg, .png, .webp, or .pdf extension",
      };
    }
    return { ok: true };
  }

  // Punching: browsers often omit MIME for EMB/DST — allow octet-stream by extension.
  if (PUNCHING_EXTENSIONS.has(ext)) {
    return { ok: true };
  }
  if (SKETCH_MIMES.has(mime) && SKETCH_EXTENSIONS.has(ext)) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 400,
    message: "Punching files must be EMB, DST, or PDF",
  };
}

/** Detect JPEG / PNG / WebP / PDF from leading bytes. Returns null when unrecognized. */
export function detectContentSignature(
  buffer: Uint8Array | ArrayBuffer,
): "jpeg" | "png" | "webp" | "pdf" | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 4) return null;

  // JPEG FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // PNG 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  // PDF %PDF
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "pdf";
  }
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/**
 * Validate content signatures for image/PDF categories.
 * Punching EMB/DST proprietary formats skip magic-byte checks.
 */
export function validateUploadContent(
  buffer: Uint8Array | ArrayBuffer,
  file: { name: string; type: string },
  category: UploadCategory,
): UploadValidationResult {
  const ext = fileExtension(file.name);

  if (category === "PUNCHING" && (ext === "emb" || ext === "dst")) {
    return { ok: true };
  }

  const signature = detectContentSignature(buffer);
  if (!signature) {
    return {
      ok: false,
      status: 400,
      message: "File content does not match an allowed image or PDF format",
    };
  }

  if (category === "PRODUCT_IMAGE") {
    if (signature === "pdf") {
      return {
        ok: false,
        status: 400,
        message: "Product images must be JPEG, PNG, or WebP",
      };
    }
    return { ok: true };
  }

  // SKETCH and punching PDF/image uploads
  return { ok: true };
}

/** Full server-side validation: metadata then content bytes. */
export function validateUploadPayload(
  file: { name: string; type: string; size: number },
  category: UploadCategory,
  buffer: Uint8Array | ArrayBuffer,
): UploadValidationResult {
  const meta = validateUploadFile(file, category);
  if (!meta.ok) return meta;
  return validateUploadContent(buffer, file, category);
}

/** Client-side preflight so UI can show the configured limit before the request. */
export function validateUploadFileClient(
  file: File,
  category: UploadCategory,
): UploadValidationResult {
  return validateUploadFile(
    { name: file.name, type: file.type || "", size: file.size },
    category,
  );
}
