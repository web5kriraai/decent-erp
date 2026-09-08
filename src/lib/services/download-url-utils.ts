import { getPresignedDownloadUrl } from "@/lib/storage";

/** Attach a short-lived download URL when a storage key is present. */
export async function withDownloadUrl<T extends { storageKey?: string | null }>(
  row: T,
): Promise<T & { downloadUrl: string | null }> {
  if (!row.storageKey?.trim()) {
    return { ...row, downloadUrl: null };
  }
  try {
    const downloadUrl = await getPresignedDownloadUrl(row.storageKey);
    return { ...row, downloadUrl };
  } catch {
    return { ...row, downloadUrl: null };
  }
}

export async function withDownloadUrls<T extends { storageKey?: string | null }>(
  rows: T[],
): Promise<Array<T & { downloadUrl: string | null }>> {
  return Promise.all(rows.map((row) => withDownloadUrl(row)));
}
