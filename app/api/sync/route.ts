import { z } from "zod";
import { CLOUD, ownerOf, setProjectOwner } from "@/lib/cloud/mode";
import { requireOwner } from "@/lib/share/actor";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

const Package = z.object({
  meta: z.object({ id: z.string().regex(/^[a-z0-9-]+$/), name: z.string() }).passthrough(),
  events: z.string(),
  bundle: z.string(),
  shots: z.array(z.string()),
});

/** Takes over a project exported by another Sparkflow; says which screenshots to send next. */
export const POST = handle(async (req: Request) => {
  requireOwner(req);
  const pkg = Package.parse(await req.json());
  const uid = CLOUD ? req.headers.get("x-sparkflow-uid") : null;
  if (CLOUD) {
    const owner = ownerOf(pkg.meta.id);
    if (!uid || (owner && owner !== uid)) return Response.json({ error: "Not your project" }, { status: 403 });
  }
  const out = await orchestrator().importSync(pkg as never);
  if (uid) setProjectOwner(pkg.meta.id, uid);
  return Response.json(out);
});
