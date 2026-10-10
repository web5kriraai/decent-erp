import { describe, expect, it } from "vitest";
import {
  compressibleForCategory,
  CONCEPT_MEDIA_MAX_BYTES,
  detectContentSignature,
  fileTooLargeMessage,
  formatBytes,
  isCompressibleType,
  uploadHintForCategory,
  uploadHintForMediaKind,
  maxBytesForCategory,
  resolveUploadCategory,
  STORED_FILE_MAX_BYTES,
  STORED_MEDIA_MAX_BYTES,
  UPLOAD_MAX_BYTES,
  validateConceptMedia,
  validateUploadContent,
  validateUploadFile,
  validateUploadPayload,
} from "@/lib/file-upload-policy";

function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
}

function pdfBytes(): Uint8Array {
  return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
}

function webpBytes(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
}

describe("file-upload-policy", () => {
  it("resolves category from explicit form field", () => {
    expect(resolveUploadCategory("SKETCH", "file.pdf")).toBe("SKETCH");
    expect(resolveUploadCategory("PUNCHING", "file.jpg")).toBe("PUNCHING");
    expect(resolveUploadCategory("PRODUCT_IMAGE", "file.dst")).toBe("PRODUCT_IMAGE");
  });

  it("infers category from extension when category omitted", () => {
    expect(resolveUploadCategory(undefined, "design.emb")).toBe("PUNCHING");
    expect(resolveUploadCategory(undefined, "sketch.pdf")).toBe("SKETCH");
    expect(resolveUploadCategory(undefined, "photo.png")).toBe("PRODUCT_IMAGE");
  });

  it("enforces a 500 KB cap and a 5 MB cap for audio and video", () => {
    expect(UPLOAD_MAX_BYTES.PRODUCT_IMAGE).toBe(STORED_FILE_MAX_BYTES);
    expect(UPLOAD_MAX_BYTES.SKETCH).toBe(500 * 1024);
    expect(UPLOAD_MAX_BYTES.PUNCHING).toBe(500 * 1024);
    expect(maxBytesForCategory("SKETCH")).toBe(UPLOAD_MAX_BYTES.SKETCH);
    expect(CONCEPT_MEDIA_MAX_BYTES.IMAGE).toBe(500 * 1024);
    expect(CONCEPT_MEDIA_MAX_BYTES.FILE).toBe(500 * 1024);
    expect(CONCEPT_MEDIA_MAX_BYTES.AUDIO).toBe(STORED_MEDIA_MAX_BYTES);
    expect(CONCEPT_MEDIA_MAX_BYTES.VIDEO).toBe(5 * 1024 * 1024);
  });

  it("formats sizes in KB or MB", () => {
    expect(formatBytes(500 * 1024)).toBe("500 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(Math.round(3.2 * 1024 * 1024))).toBe("3.2 MB");
  });

  it("builds upload hints from the shared limits", () => {
    expect(uploadHintForMediaKind("IMAGE", true)).toContain("Images are compressed automatically");
    expect(uploadHintForMediaKind("IMAGE", true)).toContain("500 KB");
    expect(uploadHintForMediaKind("IMAGE", true)).toContain("5 MB");
    expect(uploadHintForMediaKind("AUDIO")).toBe("Max 5 MB");
    expect(uploadHintForCategory("SKETCH")).toContain("500 KB");
    expect(uploadHintForCategory("PUNCHING")).toContain("not compressed automatically");
    expect(uploadHintForCategory("PUNCHING")).not.toContain("50 MB");
  });

  it("treats only jpeg, png, and webp as compressible", () => {
    expect(isCompressibleType("image/png")).toBe(true);
    expect(isCompressibleType("image/jpeg")).toBe(true);
    expect(isCompressibleType("application/pdf")).toBe(false);
    expect(isCompressibleType("audio/mpeg")).toBe(false);
    expect(isCompressibleType("video/mp4")).toBe(false);
    expect(compressibleForCategory("SKETCH", "image/webp")).toBe(true);
    expect(compressibleForCategory("PUNCHING", "application/pdf")).toBe(false);
  });

  it("rejects oversized files with the file name and the limit", () => {
    const result = validateUploadFile(
      { name: "big.png", type: "image/png", size: UPLOAD_MAX_BYTES.PRODUCT_IMAGE + 1 },
      "PRODUCT_IMAGE",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.code).toBe("TOO_LARGE");
      expect(result.maxBytes).toBe(500 * 1024);
      expect(result.actualBytes).toBe(UPLOAD_MAX_BYTES.PRODUCT_IMAGE + 1);
      expect(result.message).toContain("big.png");
      expect(result.message).toContain("500 KB");
      expect(result.message).toContain("Reduce the file size and try again.");
      expect(result.message).not.toContain("cannot be compressed");
    }
  });

  it("tells the user when a non-image cannot be compressed", () => {
    const result = validateUploadFile(
      { name: "sheet.pdf", type: "application/pdf", size: 600 * 1024 },
      "SKETCH",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe(
        fileTooLargeMessage({
          fileName: "sheet.pdf",
          actualBytes: 600 * 1024,
          maxBytes: 500 * 1024,
          compressible: false,
        }),
      );
      expect(result.message).toContain("cannot be compressed automatically");
    }
  });

  it("rejects empty files", () => {
    const result = validateUploadFile(
      { name: "a.png", type: "image/png", size: 0 },
      "PRODUCT_IMAGE",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EMPTY");
  });

  it("allows audio and video up to 5 MB", () => {
    expect(
      validateConceptMedia(
        { name: "clip.mp3", type: "audio/mpeg", size: 1024 * 1024 },
        "AUDIO",
      ).ok,
    ).toBe(true);
    const video = validateConceptMedia(
      { name: "clip.mp4", type: "video/mp4", size: 6 * 1024 * 1024 },
      "VIDEO",
    );
    expect(video.ok).toBe(false);
    if (!video.ok) {
      expect(video.status).toBe(413);
      expect(video.message).toContain("5 MB");
      expect(video.maxBytes).toBe(5 * 1024 * 1024);
    }
  });

  it("rejects product images with empty or octet-stream MIME", () => {
    expect(
      validateUploadFile({ name: "a.png", type: "", size: 100 }, "PRODUCT_IMAGE").ok,
    ).toBe(false);
    expect(
      validateUploadFile(
        { name: "a.png", type: "application/octet-stream", size: 100 },
        "PRODUCT_IMAGE",
      ).ok,
    ).toBe(false);
    expect(
      validateUploadFile({ name: "a.png", type: "image/png", size: 100 }, "PRODUCT_IMAGE").ok,
    ).toBe(true);
  });

  it("rejects sketch uploads without a real MIME type", () => {
    expect(
      validateUploadFile(
        { name: "a.pdf", type: "application/octet-stream", size: 100 },
        "SKETCH",
      ).ok,
    ).toBe(false);
    expect(
      validateUploadFile({ name: "a.pdf", type: "application/pdf", size: 100 }, "SKETCH").ok,
    ).toBe(true);
  });

  it("accepts punching EMB/DST with octet-stream MIME", () => {
    expect(
      validateUploadFile(
        { name: "punch.emb", type: "application/octet-stream", size: 100 },
        "PUNCHING",
      ).ok,
    ).toBe(true);
  });

  it("detects content signatures", () => {
    expect(detectContentSignature(pngBytes())).toBe("png");
    expect(detectContentSignature(jpegBytes())).toBe("jpeg");
    expect(detectContentSignature(pdfBytes())).toBe("pdf");
    expect(detectContentSignature(webpBytes())).toBe("webp");
    expect(detectContentSignature(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });

  it("validates content bytes for product images", () => {
    expect(
      validateUploadContent(pngBytes(), { name: "a.png", type: "image/png" }, "PRODUCT_IMAGE")
        .ok,
    ).toBe(true);
    expect(
      validateUploadContent(pdfBytes(), { name: "a.pdf", type: "application/pdf" }, "PRODUCT_IMAGE")
        .ok,
    ).toBe(false);
    expect(
      validateUploadContent(
        new Uint8Array([0, 1, 2, 3]),
        { name: "a.png", type: "image/png" },
        "PRODUCT_IMAGE",
      ).ok,
    ).toBe(false);
  });

  it("requires a minimum payload for punching EMB when the signature is unclear", () => {
    expect(
      validateUploadContent(
        new Uint8Array([0, 1, 2, 3]),
        { name: "punch.emb", type: "application/octet-stream" },
        "PUNCHING",
      ).ok,
    ).toBe(false);
    expect(
      validateUploadContent(
        new Uint8Array(128),
        { name: "punch.emb", type: "application/octet-stream" },
        "PUNCHING",
      ).ok,
    ).toBe(true);
  });

  it("runs full payload validation", () => {
    const ok = validateUploadPayload(
      { name: "a.png", type: "image/png", size: pngBytes().length },
      "PRODUCT_IMAGE",
      pngBytes(),
    );
    expect(ok.ok).toBe(true);

    const badMime = validateUploadPayload(
      { name: "a.png", type: "application/octet-stream", size: pngBytes().length },
      "PRODUCT_IMAGE",
      pngBytes(),
    );
    expect(badMime.ok).toBe(false);
  });
});
