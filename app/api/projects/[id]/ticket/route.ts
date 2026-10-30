import { actorOf } from "@/lib/share/actor";
import { mintTicket } from "@/lib/share/tickets";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** A short-lived ticket for <img src> and raw files, which can't send the guest key in a header. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = actorOf(req);
  if (actor.kind !== "guest" || actor.projectId !== id) return Response.json({ error: "Tickets are for guests" }, { status: 400 });
  return Response.json(mintTicket(actor.uid, id));
});
