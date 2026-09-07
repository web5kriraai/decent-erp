/**
 * Web Push / FCM adapter stub.
 * Configure PUSH_WEBHOOK_URL (and optional PUSH_API_KEY) to enable delivery.
 * When unset, delivery is a no-op (logged as skipped).
 */

export function isPushConfigured(): boolean {
  return !!process.env.PUSH_WEBHOOK_URL?.trim();
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

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PUSH_API_KEY
        ? { Authorization: `Bearer ${process.env.PUSH_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      title,
      body,
      payload,
      source: "decent-erp",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { sent: false, reason: `Push webhook ${res.status}: ${text.slice(0, 120)}` };
  }

  return { sent: true };
}
