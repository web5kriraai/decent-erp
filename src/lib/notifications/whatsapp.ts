export function isWhatsAppConfigured(): boolean {
  return !!process.env.WHATSAPP_WEBHOOK_URL?.trim();
}

export async function sendWhatsAppMessage(
  text: string,
  payload?: Record<string, unknown>,
): Promise<{ sent: boolean; reason?: string }> {
  const url = process.env.WHATSAPP_WEBHOOK_URL?.trim();
  if (!url) {
    return { sent: false, reason: "WHATSAPP_WEBHOOK_URL not configured" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.WHATSAPP_API_KEY
        ? { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      text,
      payload,
      source: "decent-erp",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { sent: false, reason: `WhatsApp webhook ${res.status}: ${body.slice(0, 120)}` };
  }

  return { sent: true };
}
