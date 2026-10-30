import { createHash } from "node:crypto";
import type { Access } from "@/lib/shared/share";
import { actorOf } from "@/lib/share/actor";
import { leave, people, touchKey } from "@/lib/share/store";
import { handle, orchestrator, type RouteCtx } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** Who the caller is on this project, and everyone it is shared with (for avatars and the toolbar). */
export const GET = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = actorOf(req);
  if (actor.kind === "public") return Response.json({ error: "Not found" }, { status: 404 });
  await orchestrator().store.readMeta(id);
  if (actor.kind === "guest") {
    // Keeps the key's sliding expiry alive; the store throttles the write itself.
    const key = req.headers.get("x-sparkflow-token");
    if (key) await touchKey(createHash("sha256").update(key).digest("hex"));
  }
  const out: Access =
    actor.kind === "owner"
      ? { role: "owner", me: "owner", projectId: id, people: await people(id), sharing: true }
      : { role: actor.role, me: actor.uid, projectId: id, people: await people(id), sharing: true };
  return Response.json(out);
});

/** A guest leaving the project. */
export const DELETE = handle(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const actor = actorOf(req);
  if (actor.kind !== "guest") return Response.json({ error: "Only a guest can leave" }, { status: 400 });
  await leave(id, actor.uid);
  return new Response(null, { status: 204 });
});
