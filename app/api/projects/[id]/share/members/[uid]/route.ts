import { z } from "zod";
import { requireOwner } from "@/lib/share/actor";
import { removeMember, renameMember, setRole } from "@/lib/share/store";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

type Ctx = RouteCtx<{ id: string; uid: string }>;

/** Changes a member's role or the name shown for them. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  requireOwner(req);
  const { id, uid } = await params;
  const body = z.object({ role: z.enum(["edit", "comment", "view"]).optional(), name: z.string().trim().min(1).max(60).optional() }).parse(await req.json());
  if (body.role) await setRole(id, uid, body.role);
  if (body.name) await renameMember(id, uid, body.name);
  return Response.json({ ok: true });
});

/** Removes a member; their keys stop working on their next request. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  requireOwner(req);
  const { id, uid } = await params;
  await removeMember(id, uid);
  // Out of the cloud copy's readers too.
  orchestrator().cloudSync(id);
  return Response.json({ ok: true });
});
