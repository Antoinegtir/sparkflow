import { requireOwner } from "@/lib/share/actor";
import { currentTunnelUrl, publishBeacon, serverUid } from "@/lib/share/firebase";
import { hasActiveSharing } from "@/lib/share/store";
import { handle } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/**
 * Publishes this Mac's tunnel address for guests. No body: the address comes from connection.json, so
 * a caller can't point guests elsewhere. Called by the launcher on this Mac only (?offline=1 on stop).
 */
export const POST = handle(async (req: Request) => {
  if (req.headers.get("cf-connecting-ip")) return Response.json({ error: "Not found" }, { status: 404 });
  requireOwner(req);
  if (!serverUid() || !(await hasActiveSharing())) return new Response(null, { status: 204 });
  const offline = new URL(req.url).searchParams.has("offline");
  await publishBeacon(offline ? null : currentTunnelUrl());
  return new Response(null, { status: 204 });
});
