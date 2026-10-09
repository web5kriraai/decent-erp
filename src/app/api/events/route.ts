import { requireSession } from "@/lib/auth";
import { loadEmployeeSessionPermissions } from "@/lib/session-permissions";
import { subscribeRealtime } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.employeeId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const fresh = await loadEmployeeSessionPermissions(session.user.employeeId);
  const companyId = fresh.companyId ?? session.user.companyId;
  const employeeId = session.user.employeeId;
  if (!companyId) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      send("retry: 3000\n\n");
      send("event: ready\ndata: {}\n\n");

      unsubscribe = subscribeRealtime((message) => {
        if (message.companyId !== companyId) return;
        if (
          message.employeeIds?.length &&
          !message.employeeIds.includes(employeeId)
        ) {
          return;
        }
        send(`data: ${JSON.stringify({ topics: message.topics })}\n\n`);
      });

      heartbeat = setInterval(() => {
        send(": heartbeat\n\n");
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
