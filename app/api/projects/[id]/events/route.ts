import os from "node:os";
import { actorOf } from "@/lib/share/actor";
import type { RouteCtx } from "@/lib/web/server";
import { errorResponse, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Server-sent events: replay from Last-Event-ID / ?since=, then live, with a ping every 15 s (or one JSON batch with ?poll=1). */
export async function GET(req: Request, { params }: RouteCtx) {
  const { id } = await params;
  const url = new URL(req.url);
  let guest: boolean;
  try {
    guest = actorOf(req).kind === "guest";
  } catch (err) {
    return errorResponse(err);
  }
  // Guests poll: a stream would keep delivering after their access is removed.
  if (guest && !url.searchParams.has("poll")) return Response.json({ error: "Guests poll for events", code: "role" }, { status: 403 });
  const since = Number(req.headers.get("last-event-id") ?? url.searchParams.get("since") ?? 0) || 0;
  // ?poll=1: the events since `since` as JSON, for the hosted site (the Cloudflare quick tunnel
  // holds back a streamed body, so it polls instead).
  if (url.searchParams.has("poll")) {
    try {
      const events: unknown[] = [];
      const unsubscribe = await orchestrator().streamEvents(id, since, (e) => events.push(e));
      unsubscribe();
      if (!guest) return Response.json(events, { headers: { "cache-control": "no-store" } });
      // Log lines and errors can carry local paths: guests see ~ instead of the owner's home folder.
      const home = os.homedir();
      return new Response(JSON.stringify(events).split(JSON.stringify(home).slice(1, -1)).join("~"), {
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    } catch (err) {
      return errorResponse(err);
    }
  }
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
