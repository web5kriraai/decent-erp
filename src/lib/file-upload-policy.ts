export type UploadCategory = "PRODUCT_IMAGE" | "SKETCH" | "PUNCHING";

/** Design-concept media kinds stored on DesignImage.mediaKind. */
export type ConceptMediaKind = "IMAGE" | "AUDIO" | "VIDEO" | "FILE";

export const CONCEPT_MEDIA_KINDS: ConceptMediaKind[] = [
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "FILE",
];

const KB = 1024;
const MB = 1024 * 1024;

/** Stored size cap for images and every non-media file. */
export const STORED_FILE_MAX_BYTES = 500 * KB;
/** Stored size cap for audio and video only. */
export const STORED_MEDIA_MAX_BYTES = 5 * MB;

export const UPLOAD_MAX_BYTES: Record<UploadCategory, number> = {
  PRODUCT_IMAGE: STORED_FILE_MAX_BYTES,
  SKETCH: STORED_FILE_MAX_BYTES,
  PUNCHING: STORED_FILE_MAX_BYTES,
};

export const CONCEPT_MEDIA_MAX_BYTES: Record<ConceptMediaKind, number> = {
  IMAGE: STORED_FILE_MAX_BYTES,
  AUDIO: STORED_MEDIA_MAX_BYTES,
  VIDEO: STORED_MEDIA_MAX_BYTES,
  FILE: STORED_FILE_MAX_BYTES,
};

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "ogg", "webm"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);
const CONCEPT_FILE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "zip",
  "emb",
  "dst",
]);
const CONCEPT_FILE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

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

export function maxBytesForMediaKind(kind: ConceptMediaKind): number {
  return CONCEPT_MEDIA_MAX_BYTES[kind];
}

/** Human size: whole numbers stay whole, otherwise one decimal. */
export function formatBytes(bytes: number): string {
  const abs = Math.max(0, bytes);
  if (abs < KB) return `${Math.round(abs)} B`;
  if (abs < MB) return `${trimOneDecimal(abs / KB)} KB`;
  return `${trimOneDecimal(abs / MB)} MB`;
}

function trimOneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

const COMPRESSIBLE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** Browser canvas can shrink these image types. PDF, EMB/DST, audio, and video cannot. */
export function isCompressibleType(contentType: string): boolean {
  return COMPRESSIBLE_IMAGE_MIMES.has((contentType || "").toLowerCase());
}

export function compressibleForCategory(
  _category: UploadCategory,
  contentType: string,
): boolean {
  return isCompressibleType(contentType);
}

export function fileTooLargeMessage(options: {
  fileName: string;
  actualBytes: number;
  maxBytes: number;
  compressible: boolean;
}): string {
  const name = options.fileName.trim() || "This file";
  const base = `${name} is ${formatBytes(options.actualBytes)}. Maximum allowed is ${formatBytes(options.maxBytes)}. Reduce the file size and try again.`;
  if (options.compressible) return base;
  return `${base} This file type cannot be compressed automatically.`;
}

export function limitLabelForCategory(category: UploadCategory): string {
  return formatBytes(maxBytesForCategory(category));
}

export function uploadHintForCategory(category: UploadCategory): string {
  const limit = limitLabelForCategory(category);
  if (category === "PUNCHING") {
    return `EMB, DST, PDF · max ${limit}. These files are not compressed automatically`;
  }
  if (category === "SKETCH") {
    return `JPEG, PNG, WebP, PDF · images are compressed automatically · max ${limit}`;
  }
  return `JPEG, PNG, WebP · images are compressed automatically · max ${limit}`;
}

export function uploadHintForMediaKind(
  kind: ConceptMediaKind,
  autoDetect = false,
): string {
  if (autoDetect) {
    return `Images are compressed automatically. Max ${formatBytes(STORED_FILE_MAX_BYTES)} (audio and video ${formatBytes(STORED_MEDIA_MAX_BYTES)})`;
  }
  if (kind === "IMAGE") {
    return `Images are compressed automatically. Max ${limitLabelForMediaKind(kind)}`;
  }
  if (kind === "AUDIO" || kind === "VIDEO") {
    return `Max ${limitLabelForMediaKind(kind)}`;
  }
  return `Max ${limitLabelForMediaKind(kind)}. This file type is not compressed automatically`;
}

function fileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isLooseBinaryMime(type: string): boolean {
  return !type || type === "application/octet-stream";
}

export type UploadRejectCode = "TOO_LARGE" | "UNSUPPORTED_TYPE" | "EMPTY";

export type UploadValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      status: 400 | 413;
      code: UploadRejectCode;
      maxBytes?: number;
      actualBytes?: number;
    };

function rejectIfEmptyOrTooLarge(
  file: { name: string; type: string; size: number },
  maxBytes: number,
): UploadValidationResult | null {
  const fileName = file.name?.trim() || "This file";
  if (file.size <= 0) {
    return {
      ok: false,
      status: 400,
      code: "EMPTY",
      message: `${fileName} is empty. Choose a file with content.`,
    };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      status: 413,
      code: "TOO_LARGE",
      maxBytes,
      actualBytes: file.size,
      message: fileTooLargeMessage({
        fileName,
        actualBytes: file.size,
        maxBytes,
        compressible: isCompressibleType(file.type),
      }),
    };
  }
  return null;
}

function unsupported(message: string): UploadValidationResult {
  return { ok: false, status: 400, code: "UNSUPPORTED_TYPE", message };
}

export function validateUploadFile(
  file: { name: string; type: string; size: number },
  category: UploadCategory,
): UploadValidationResult {
  const sizeError = rejectIfEmptyOrTooLarge(file, maxBytesForCategory(category));
  if (sizeError) return sizeError;

  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();

  if (category === "PRODUCT_IMAGE") {
    if (isLooseBinaryMime(mime) || !PRODUCT_IMAGE_MIMES.has(mime)) {
      return unsupported("Product images must be JPEG, PNG, or WebP");
    }
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return unsupported(
        "Product images must use a .jpg, .jpeg, .png, or .webp extension",
      );
    }
    return { ok: true };
  }

  if (category === "SKETCH") {
    const mimeOk = SKETCH_MIMES.has(mime);
    const extOk = SKETCH_EXTENSIONS.has(ext);
    if (isLooseBinaryMime(mime)) {
      return unsupported(
        "Sketch files must be JPEG, PNG, WebP, or PDF (MIME type required)",
      );
    }
    if (!mimeOk && !extOk) {
      return unsupported("Sketch files must be JPEG, PNG, WebP, or PDF");
    }
    if (!extOk) {
      return unsupported(
        "Sketch files must use a .jpg, .jpeg, .png, .webp, or .pdf extension",
      );
    }
    return { ok: true };
  }

  // Punching: browsers often omit MIME for EMB/DST - allow octet-stream by extension.
  if (PUNCHING_EXTENSIONS.has(ext)) {
    return { ok: true };
  }
  if (SKETCH_MIMES.has(mime) && SKETCH_EXTENSIONS.has(ext)) {
    return { ok: true };
  }
  return unsupported("Punching files must be EMB, DST, or PDF");
}

/** Detect JPEG / PNG / WebP / PDF from leading bytes. Returns null when unrecognized. */
export function detectContentSignature(
  buffer: Uint8Array | ArrayBuffer,
): "jpeg" | "png" | "webp" | "pdf" | "dst" | "emb" | null {
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

  // Tajima DST: 512-byte header typically ends with 0x1A; require minimum size.
  if (bytes.length >= 512 && bytes[511] === 0x1a) return "dst";
  // Wilcom EMB: OLE/compound-ish or proprietary; accept when "EMB" / "Wilcom" appears early.
  if (bytes.length >= 64) {
    const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 256))).toString(
      "latin1",
    );
    if (/EMB|Wilcom|Embroidery/i.test(head)) return "emb";
  }

  return null;
}

/**
 * Validate content signatures for image/PDF categories.
 * Punching EMB/DST use format-aware checks (not open skip).
 */
export function validateUploadContent(
  buffer: Uint8Array | ArrayBuffer,
  file: { name: string; type: string },
  category: UploadCategory,
): UploadValidationResult {
  const ext = fileExtension(file.name);
  const signature = detectContentSignature(buffer);

  if (category === "PUNCHING" && (ext === "emb" || ext === "dst")) {
    if (ext === "dst" && signature === "dst") return { ok: true };
    if (ext === "emb" && (signature === "emb" || signature == null)) {
      // EMB layouts vary; require minimum payload when magic is inconclusive.
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      if (bytes.length >= 128) return { ok: true };
    }
    if (signature === "pdf" || signature === "jpeg" || signature === "png" || signature === "webp") {
      return { ok: true };
    }
    return unsupported(
      "Punching file content does not look like a valid EMB/DST payload",
    );
  }

  if (!signature || signature === "dst" || signature === "emb") {
    return unsupported(
      "File content does not match an allowed image or PDF format",
    );
  }

  if (category === "PRODUCT_IMAGE") {
    if (signature === "pdf") {
      return unsupported("Product images must be JPEG, PNG, or WebP");
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

export function parseConceptMediaKind(
  raw: string | null | undefined,
): ConceptMediaKind {
  const normalized = raw?.toUpperCase();
  if (
    normalized === "IMAGE" ||
    normalized === "AUDIO" ||
    normalized === "VIDEO" ||
    normalized === "FILE"
  ) {
    return normalized;
  }
  return "IMAGE";
}

export function limitLabelForMediaKind(kind: ConceptMediaKind): string {
  return formatBytes(CONCEPT_MEDIA_MAX_BYTES[kind]);
}

export function acceptForConceptMedia(kind: ConceptMediaKind): string {
  if (kind === "AUDIO") return "audio/*,.mp3,.wav,.m4a,.ogg,.webm";
  if (kind === "VIDEO") return "video/*,.mp4,.webm,.mov";
  if (kind === "FILE") {
    return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.emb,.dst,application/pdf,application/zip";
  }
  return "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
}

/** Broad accept for auto-detect upload (image / audio / video / docs). */
export function acceptForAllConceptMedia(): string {
  return [
    acceptForConceptMedia("IMAGE"),
    acceptForConceptMedia("AUDIO"),
    acceptForConceptMedia("VIDEO"),
    acceptForConceptMedia("FILE"),
  ].join(",");
}

/**
 * Validate concept media (IMAGE/AUDIO/VIDEO/FILE).
 * IMAGE reuses PRODUCT_IMAGE rules + magic bytes when a buffer is provided.
 */
export function validateConceptMedia(
  file: { name: string; type: string; size: number },
  kind: ConceptMediaKind,
  buffer?: Uint8Array | ArrayBuffer,
): UploadValidationResult {
  const sizeError = rejectIfEmptyOrTooLarge(file, CONCEPT_MEDIA_MAX_BYTES[kind]);
  if (sizeError) return sizeError;

  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();

  if (kind === "IMAGE") {
    const meta = validateUploadFile(file, "PRODUCT_IMAGE");
    if (!meta.ok) return meta;
    if (buffer) return validateUploadContent(buffer, file, "PRODUCT_IMAGE");
    return { ok: true };
  }

  if (kind === "AUDIO") {
    const mimeOk = mime.startsWith("audio/");
    const extOk = AUDIO_EXTENSIONS.has(ext);
    if (!mimeOk && !extOk) {
      return unsupported("Audio must be MP3, WAV, M4A, OGG, or WebM");
    }
    return { ok: true };
  }

  if (kind === "VIDEO") {
    const mimeOk = mime.startsWith("video/");
    const extOk = VIDEO_EXTENSIONS.has(ext);
    if (!mimeOk && !extOk) {
      return unsupported("Video must be MP4, WebM, or MOV");
    }
    return { ok: true };
  }

  // FILE
  const mimeOk = CONCEPT_FILE_MIMES.has(mime) || isLooseBinaryMime(mime);
  const extOk = CONCEPT_FILE_EXTENSIONS.has(ext);
  if (!extOk) {
    return unsupported(
      "Files must be PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, ZIP, EMB, or DST",
    );
  }
  if (!mimeOk && !isLooseBinaryMime(mime)) {
    return unsupported("File type is not allowed for concept attachments");
  }
  return { ok: true };
}

export function validateConceptMediaClient(
  file: File,
  kind: ConceptMediaKind,
): UploadValidationResult {
  return validateConceptMedia(
    { name: file.name, type: file.type || "", size: file.size },
    kind,
  );
}
