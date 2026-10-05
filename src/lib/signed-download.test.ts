import { describe, expect, it } from "vitest";
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "@/lib/signed-download";
import { detectContentSignature } from "@/lib/file-upload-policy";

describe("signed downloads", () => {
  it("round-trips a valid token", () => {
    const token = createSignedDownloadToken("designs/1/file.png", 60);
    const verified = verifySignedDownloadToken(token);
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.key).toBe("designs/1/file.png");
  });

  it("rejects tampered tokens", () => {
    const token = createSignedDownloadToken("designs/1/file.png", 60);
    const verified = verifySignedDownloadToken(token + "x");
    expect(verified.ok).toBe(false);
  });
});

describe("content signatures", () => {
  it("detects PNG magic bytes", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectContentSignature(png)).toBe("png");
  });

  it("detects DST header end marker", () => {
    const dst = new Uint8Array(512);
    dst[511] = 0x1a;
    expect(detectContentSignature(dst)).toBe("dst");
  });
});
