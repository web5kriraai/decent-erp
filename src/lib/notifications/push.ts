/**
 * Web Push / FCM adapter via outbound webhook.
 * Configure PUSH_WEBHOOK_URL (+ optional PUSH_API_KEY) to enable delivery.
 */

export function isPushConfigured(): boolean {
  return !!process.env.PUSH_WEBHOOK_URL?.trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendPushNotification(
  title: string,
  body: string,
  payload?: Record<string, unknown>,
): Promise<{ sent: boolean; reason?: string }> {
  const url = process.env.PUSH_WEBHOOK_URL?.trim();
  if (!url) {
    return { sent: false, reason: "PUSH_WEBHOOK_URL not configured" };
  }

  const timeoutMs = Number(process.env.PUSH_HTTP_TIMEOUT_MS ?? 8_000);
  const maxAttempts = Math.max(1, Number(process.env.PUSH_HTTP_MAX_ATTEMPTS ?? 2));

  let lastReason = "Push webhook failed";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(process.env.PUSH_API_KEY
            ? { Authorization: `Bearer ${process.env.PUSH_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          title,
          body,
          payload: payload ?? {},
          source: "decent-erp",
          sentAtUtc: new Date().toISOString(),
          attempt,
        }),
        signal: controller.signal,
      });

      if (res.ok) return { sent: true };

      const text = await res.text().catch(() => "");
      lastReason = `Push webhook ${res.status}: ${text.slice(0, 120)}`;
      if (res.status < 500 && res.status !== 429) {
        return { sent: false, reason: lastReason };
      }
    } catch (error) {
      lastReason =
        error instanceof Error && error.name === "AbortError"
          ? `Push webhook timed out after ${timeoutMs}ms`
          : `Push webhook error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts) await sleep(200 * attempt);
  }

  return { sent: false, reason: lastReason };
}
