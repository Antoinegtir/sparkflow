import { requireOwner } from "@/lib/share/actor";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** The project for another Sparkflow to take over (the cloud ↔ this Mac): one source on both. */
export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  requireOwner(req);
  const { id } = await params;
  await orchestrator().store.readMeta(id);
  // ?head=1: only how far its history goes, to tell which side is newer.
  if (new URL(req.url).searchParams.get("head")) return Response.json({ events: (await orchestrator().store.readEvents(id)).length });
  return Response.json(await orchestrator().exportSync(id));
});
