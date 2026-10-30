import { requireOwner } from "@/lib/share/actor";
import { revokeInvite } from "@/lib/share/store";
import { handle, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Revokes an invite link; people who already joined stay members. */
export const DELETE = handle(async (req: Request, { params }: RouteCtx<{ id: string; invite: string }>) => {
  requireOwner(req);
  const { id, invite } = await params;
  await revokeInvite(id, invite);
  return Response.json({ ok: true });
});
