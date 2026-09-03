import { describe, expect, it } from "vitest";
import {
  detectContentSignature,
  maxBytesForCategory,
  resolveUploadCategory,
  UPLOAD_MAX_BYTES,
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

  it("enforces per-category size limits", () => {
    expect(UPLOAD_MAX_BYTES.PRODUCT_IMAGE).toBe(10 * 1024 * 1024);
    expect(UPLOAD_MAX_BYTES.SKETCH).toBe(25 * 1024 * 1024);
    expect(UPLOAD_MAX_BYTES.PUNCHING).toBe(50 * 1024 * 1024);
    expect(maxBytesForCategory("SKETCH")).toBe(UPLOAD_MAX_BYTES.SKETCH);
  });

  it("rejects oversized files with configured limit text", () => {
    const result = validateUploadFile(
      { name: "big.png", type: "image/png", size: UPLOAD_MAX_BYTES.PRODUCT_IMAGE + 1 },
      "PRODUCT_IMAGE",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
      expect(result.message).toContain("10MB");
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

  it("skips magic-byte check for punching EMB/DST", () => {
    expect(
      validateUploadContent(
        new Uint8Array([0, 1, 2, 3]),
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
