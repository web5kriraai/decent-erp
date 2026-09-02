import { describe, expect, it } from "vitest";
import {
  maxBytesForCategory,
  resolveUploadCategory,
  UPLOAD_MAX_BYTES,
  validateUploadFile,
} from "@/lib/file-upload-policy";

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

  it("rejects oversized files", () => {
    const result = validateUploadFile(
      { name: "big.png", type: "image/png", size: UPLOAD_MAX_BYTES.PRODUCT_IMAGE + 1 },
      "PRODUCT_IMAGE",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("10MB");
    }
  });

  it("validates product image MIME types", () => {
    expect(
      validateUploadFile({ name: "a.png", type: "image/png", size: 100 }, "PRODUCT_IMAGE").ok,
    ).toBe(true);
    expect(
      validateUploadFile({ name: "a.pdf", type: "application/pdf", size: 100 }, "PRODUCT_IMAGE").ok,
    ).toBe(false);
  });

  it("accepts punching extensions", () => {
    expect(
      validateUploadFile({ name: "punch.emb", type: "application/octet-stream", size: 100 }, "PUNCHING")
        .ok,
    ).toBe(true);
  });
});
