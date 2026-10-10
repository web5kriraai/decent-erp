import { beforeEach, describe, expect, it, vi } from "vitest";

const { compressImageForStorage } = vi.hoisted(() => ({
  compressImageForStorage: vi.fn(),
}));

vi.mock("@/lib/compress-image-client", () => ({
  STORED_IMAGE_MAX_BYTES: 500 * 1024,
  compressImageForStorage,
}));

import { prepareUploadFile } from "@/lib/prepare-upload-file";

function fileOf(name: string, type: string, size: number) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("prepareUploadFile", () => {
  beforeEach(() => {
    compressImageForStorage.mockClear();
    compressImageForStorage.mockImplementation(async (file: File) => {
      if (file.name.includes("stuck")) {
        return { ok: false, code: "CANNOT_COMPRESS", bytes: file.size };
      }
      if (file.type.startsWith("image/") && file.size > 500 * 1024) {
        return {
          ok: true,
          file: new File([new Uint8Array(120)], "photo.jpg", { type: "image/jpeg" }),
        };
      }
      return { ok: true, file };
    });
  });

  it("rejects an empty file", async () => {
    const result = await prepareUploadFile(new File([], "a.png", { type: "image/png" }), {
      category: "PRODUCT_IMAGE",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EMPTY");
    expect(compressImageForStorage).not.toHaveBeenCalled();
  });

  it("compresses a large image before the size check", async () => {
    const result = await prepareUploadFile(
      fileOf("photo.png", "image/png", 2 * 1024 * 1024),
      { mediaKind: "IMAGE" },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.type).toBe("image/jpeg");
      expect(result.file.size).toBeLessThanOrEqual(500 * 1024);
    }
    expect(compressImageForStorage).toHaveBeenCalledOnce();
  });

  it("reports an image that stays over the limit after compression", async () => {
    const result = await prepareUploadFile(
      fileOf("stuck.png", "image/png", 3 * 1024 * 1024),
      { category: "SKETCH" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CANNOT_COMPRESS");
      expect(result.status).toBe(413);
      expect(result.message).toContain("stuck.png");
      expect(result.message).toContain("after compression");
      expect(result.message).toContain("500 KB");
    }
  });

  it("rejects a PDF over 500 KB and does not compress it", async () => {
    const result = await prepareUploadFile(
      fileOf("sheet.pdf", "application/pdf", 600 * 1024),
      { category: "SKETCH" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TOO_LARGE");
      expect(result.message).toContain("sheet.pdf");
      expect(result.message).toContain("500 KB");
      expect(result.message).toContain("cannot be compressed automatically");
    }
    expect(compressImageForStorage).not.toHaveBeenCalled();
  });

  it("accepts a PDF at or under 500 KB", async () => {
    const result = await prepareUploadFile(
      fileOf("sheet.pdf", "application/pdf", 400 * 1024),
      { category: "SKETCH" },
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an unsupported file", async () => {
    const result = await prepareUploadFile(
      fileOf("notes.exe", "application/octet-stream", 100),
      { mediaKind: "FILE" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNSUPPORTED_TYPE");
  });

  it("keeps audio under 5 MB and rejects audio over 5 MB", async () => {
    const ok = await prepareUploadFile(fileOf("clip.mp3", "audio/mpeg", 1024 * 1024), {
      mediaKind: "AUDIO",
    });
    expect(ok.ok).toBe(true);

    const big = await prepareUploadFile(fileOf("long.mp3", "audio/mpeg", 6 * 1024 * 1024), {
      mediaKind: "AUDIO",
    });
    expect(big.ok).toBe(false);
    if (!big.ok) {
      expect(big.code).toBe("TOO_LARGE");
      expect(big.message).toContain("5 MB");
    }
    expect(compressImageForStorage).not.toHaveBeenCalled();
  });

  it("rejects a punching file over 500 KB", async () => {
    const result = await prepareUploadFile(
      fileOf("punch.dst", "application/octet-stream", 600 * 1024),
      { category: "PUNCHING" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TOO_LARGE");
      expect(result.message).toContain("punch.dst");
    }
  });
});
