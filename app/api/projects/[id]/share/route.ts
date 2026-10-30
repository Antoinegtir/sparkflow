import { z } from "zod";
import { requireOwner } from "@/lib/share/actor";
import { currentTunnelUrl, ensureServerIdentity, publishBeacon } from "@/lib/share/firebase";
import { createInvite, listShare } from "@/lib/share/store";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Invite links and members of a project (no secrets or hashes). */
export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  requireOwner(req);
  const { id } = await params;
  await orchestrator().store.readMeta(id);
  // The server's identity is made here too, not only with the first invite: the owner's name and avatar
  // (on their comments) are registered against it before anyone is invited. Offline, the list still loads.
  await ensureServerIdentity().catch(() => null);
  return Response.json(await listShare(id));
});

const CreateInvite = z.object({
  role: z.enum(["edit", "comment", "view"]),
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30), z.null()]),
  maxUses: z.union([z.literal(1), z.null()]),
});

/** A new invite link. The secret is returned once and only its hash is kept. */
export const POST = handle(async (req: Request, { params }: RouteCtx) => {
  requireOwner(req);
  const { id } = await params;
  const body = CreateInvite.parse(await req.json());
  await orchestrator().store.readMeta(id);
  const serverUid = await ensureServerIdentity();
  const { inviteId, secret } = await createInvite(id, body);
  // Publish the address now, so the first guest finds this Mac without waiting for the heartbeat.
  await publishBeacon(currentTunnelUrl()).catch(() => {});
  return Response.json({ serverUid, inviteId, secret }, { status: 201 });
});
