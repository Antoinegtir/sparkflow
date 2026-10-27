import type { RouteCtx } from "@/lib/web/server";
import { errorResponse, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Server-sent events: replay from Last-Event-ID / ?since=, then live, with a ping every 15 s. */
export async function GET(req: Request, { params }: RouteCtx) {
  const { id } = await params;
  const url = new URL(req.url);
  const since = Number(req.headers.get("last-event-id") ?? url.searchParams.get("since") ?? 0) || 0;
  const enc = new TextEncoder();
  let cleanup = () => {};
  try {
    await orchestrator().getState(id);
  } catch (err) {
    return errorResponse(err);
  }
  const stream = new ReadableStream({
    async start(controller) {
      const write = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {}
      };
      // Sent right away so EventSource reports "open".
      write("retry: 2000\n: connected\n\n");
      const unsubscribe = await orchestrator().streamEvents(id, since, (e) => write(`id: ${e.seq}\nevent: agent\ndata: ${JSON.stringify(e)}\n\n`));
      const ping = setInterval(() => write(": ping\n\n"), 15000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup(), { once: true });
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" },
  });
}
