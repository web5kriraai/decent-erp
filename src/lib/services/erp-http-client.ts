/**
 * Shared HTTP helpers for live partner ERP calls.
 * Timeout, retries, and auth headers so handoff POST / metrics GET behave consistently.
 */

export type ErpFetchOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  /** Override default timeout (ms). */
  timeoutMs?: number;
  /** Override default max attempts (includes first try). */
  maxAttempts?: number;
};

const DEFAULT_TIMEOUT_MS = Number(process.env.ERP_HTTP_TIMEOUT_MS ?? 15_000);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.ERP_HTTP_MAX_ATTEMPTS ?? 3);

export function erpAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const key = process.env.ERP_API_KEY?.trim();
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Fetch partner ERP with AbortSignal timeout and limited retries on network / 5xx / 429.
 */
export async function erpFetch(
  url: string,
  options: ErpFetchOptions = {},
): Promise<Response> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: erpAuthHeaders(),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok && isRetryableStatus(res.status) && attempt < maxAttempts) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }

      return res;
    } catch (error) {
      lastError = error;
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("aborted"));
      if (attempt < maxAttempts) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      if (aborted) {
        throw new Error(`ERP request timed out after ${timeoutMs}ms: ${url}`);
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("ERP request failed");
}

export async function erpFetchJson<T>(
  url: string,
  options: ErpFetchOptions = {},
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; body: string }> {
  const res = await erpFetch(url, options);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body };
  }
  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}
