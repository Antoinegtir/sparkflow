import { CLOUD, ownerOf } from "@/lib/cloud/mode";
import { requireOwner } from "@/lib/share/actor";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

/** One screenshot of a project taken over (?id=&name=, the PNG as the body). */
export const POST = handle(async (req: Request) => {
  requireOwner(req);
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const name = url.searchParams.get("name") ?? "";
  if (CLOUD && ownerOf(id) !== req.headers.get("x-sparkflow-uid")) return Response.json({ error: "Not your project" }, { status: 403 });
  await orchestrator().store.readMeta(id);
  await orchestrator().store.saveShot(id, name, Buffer.from(await req.arrayBuffer()));
  return Response.json({ ok: true });
});
