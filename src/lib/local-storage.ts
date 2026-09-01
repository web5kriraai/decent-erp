import fs from "node:fs/promises";
import path from "node:path";
import { StorageError } from "@/lib/storage-types";

const DEFAULT_LOCAL_STORAGE_DIR = ".local-storage";

let cachedLocalRoot: string | undefined;

/** Resolved at runtime — never at module load — to keep Turbopack tracing scoped. */
export function getLocalStorageRoot(): string {
  if (cachedLocalRoot !== undefined) return cachedLocalRoot;

  const configured = process.env.LOCAL_STORAGE_PATH?.trim();
  if (
    configured &&
    configured.length > 0 &&
    configured !== DEFAULT_LOCAL_STORAGE_DIR &&
    !configured.includes("..")
  ) {
    cachedLocalRoot = path.join(/* turbopackIgnore: true */ process.cwd(), configured);
  } else {
    cachedLocalRoot = path.join(process.cwd(), DEFAULT_LOCAL_STORAGE_DIR);
  }

  return cachedLocalRoot;
}

function assertSafeKey(key: string) {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) {
    throw new StorageError("Invalid storage key");
  }
}

function localFilePath(key: string) {
  assertSafeKey(key);
  const root = getLocalStorageRoot();
  const resolved = path.join(/* turbopackIgnore: true */ root, ...key.split("/"));
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootPrefix)) {
    throw new StorageError("Invalid storage key path");
  }
  return resolved;
}

function localMetaPath(key: string) {
  return `${localFilePath(key)}.meta.json`;
}

export function localDownloadPath(key: string) {
  assertSafeKey(key);
  return `/api/files/${key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export async function uploadToLocal(key: string, body: Buffer | Uint8Array, contentType: string) {
  const filePath = localFilePath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, body);
  await fs.writeFile(
    localMetaPath(key),
    JSON.stringify({ contentType, uploadedAtUtc: new Date().toISOString() }),
    "utf8",
  );
}

export async function deleteFromLocal(key: string) {
  const filePath = localFilePath(key);
  await fs.rm(filePath, { force: true });
  await fs.rm(localMetaPath(key), { force: true });
}

export async function readLocalObject(key: string) {
  assertSafeKey(key);
  const filePath = localFilePath(key);
  const body = await fs.readFile(/* turbopackIgnore: true */ filePath);
  let contentType = "application/octet-stream";
  try {
    const metaRaw = await fs.readFile(/* turbopackIgnore: true */ localMetaPath(key), "utf8");
    const meta = JSON.parse(metaRaw) as { contentType?: string };
    if (meta.contentType) contentType = meta.contentType;
  } catch {
    /* optional metadata */
  }
  return { body, contentType };
}
