import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImageForStorage } from "@/lib/compress-image-client";

function stubCanvas(blobBytes: number) {
  vi.stubGlobal(
    "createImageBitmap",
    async () => ({
      width: 2000,
      height: 1500,
      close: () => {},
    }),
  );
  vi.stubGlobal("document", {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: "",
        fillRect: () => {},
        drawImage: () => {},
      }),
      toBlob: (callback: (blob: Blob | null) => void) => {
        callback(new Blob([new Uint8Array(blobBytes)], { type: "image/jpeg" }));
      },
    }),
  });
}

describe("compressImageForStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns non-images unchanged", async () => {
    const file = new File([new Uint8Array(10)], "a.pdf", { type: "application/pdf" });
    const result = await compressImageForStorage(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file).toBe(file);
  });

  it("returns a jpeg at or under 500 KB when compression succeeds", async () => {
    stubCanvas(40 * 1024);
    const file = new File([new Uint8Array(900 * 1024)], "photo.png", { type: "image/png" });
    const result = await compressImageForStorage(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.type).toBe("image/jpeg");
      expect(result.file.name).toBe("photo.jpg");
      expect(result.file.size).toBeLessThanOrEqual(500 * 1024);
    }
  });

  it("fails when the image is still over 500 KB after every attempt", async () => {
    stubCanvas(600 * 1024);
    const file = new File([new Uint8Array(800 * 1024)], "photo.png", { type: "image/png" });
    const result = await compressImageForStorage(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CANNOT_COMPRESS");
      expect(result.bytes).toBe(600 * 1024);
    }
  });
});
