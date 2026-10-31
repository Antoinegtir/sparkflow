import { z } from "zod";
import { CLOUD, ownerOf, projectsOf, setProjectOwner } from "@/lib/cloud/mode";
import { appSlugs } from "@/lib/shared";
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
  if (!uid) return Response.json(out);
  setProjectOwner(pkg.meta.id, uid);
  // Its address among this person's apps (see GET /api/projects).
  const mine = projectsOf(uid);
  const own = (await orchestrator().listProjects()).filter((p) => mine.has(p.id));
  return Response.json({ ...out, slug: appSlugs(own).get(pkg.meta.id) ?? out.slug });
});
