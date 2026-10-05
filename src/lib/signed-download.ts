import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = Number(process.env.FILE_DOWNLOAD_TTL_SECONDS ?? 300);

function signingSecret(): string {
  return (
    process.env.FILE_SIGNING_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "decent-erp-dev-file-signing"
  );
}

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

/** Short-lived HMAC token so download URLs are non-guessable and expire. */
export function createSignedDownloadToken(
  key: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + Math.max(30, ttlSeconds);
  const payload = b64url(JSON.stringify({ key, exp }));
  const sig = createHmac("sha256", signingSecret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

export function verifySignedDownloadToken(
  token: string,
): { ok: true; key: string } | { ok: false; reason: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "Malformed download token" };
  const [payload, sig] = parts;
  const expected = createHmac("sha256", signingSecret()).update(payload).digest();
  let provided: Buffer;
  try {
    provided = fromB64url(sig);
  } catch {
    return { ok: false, reason: "Invalid download token signature" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: "Invalid download token signature" };
  }
  try {
    const parsed = JSON.parse(fromB64url(payload).toString("utf8")) as {
      key?: string;
      exp?: number;
    };
    if (!parsed.key || typeof parsed.exp !== "number") {
      return { ok: false, reason: "Invalid download token payload" };
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: "Download token expired" };
    }
    if (parsed.key.includes("..") || parsed.key.startsWith("/")) {
      return { ok: false, reason: "Invalid storage key" };
    }
    return { ok: true, key: parsed.key };
  } catch {
    return { ok: false, reason: "Invalid download token payload" };
  }
}

export function signedAppDownloadPath(key: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const token = createSignedDownloadToken(key, ttlSeconds);
  return `/api/files/download?token=${encodeURIComponent(token)}`;
}

export function filePresignTtlSeconds(): number {
  return Math.max(30, Number(process.env.FILE_DOWNLOAD_TTL_SECONDS ?? 300));
}

/** When true, S3 objects are streamed through the app signed endpoint instead of MinIO URLs. */
export function preferProxiedDownloads(): boolean {
  return process.env.FILE_PROXY_DOWNLOADS === "true";
}
