import { appSlugs, CreateProjectRequest } from "@/lib/shared";
import { CLOUD, projectsOf, setProjectOwner } from "@/lib/cloud/mode";
import { actorOf, requireOwner } from "@/lib/share/actor";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const actor = actorOf(req);
  const all = await orchestrator().listProjects();
  // In the cloud, each person sees the apps they made (the proxy set who they are).
  if (CLOUD) {
    const mine = projectsOf(req.headers.get("x-sparkflow-uid") ?? "");
    // Addresses among one's own apps only: someone else's "Wander" doesn't make yours /wander-2.
    const own = all.filter((p) => mine.has(p.id));
    const slugs = appSlugs(own);
    return Response.json(own.map((p) => ({ ...p, slug: slugs.get(p.id)! })));
  }
  // A guest sees only the project their key opens.
  return Response.json(actor.kind === "guest" ? all.filter((p) => p.id === actor.projectId) : all);
});

export const POST = handle(async (req: Request) => {
  requireOwner(req);
  const body = CreateProjectRequest.parse(await req.json());
  const uid = CLOUD ? req.headers.get("x-sparkflow-uid") : null;
  if (CLOUD && !uid) return Response.json({ error: "Sign in first" }, { status: 401 });
  // Owned before its build starts, so its own events and screenshots are reachable at once.
  const meta = await orchestrator().createProject(body, (id) => uid && setProjectOwner(id, uid));
  return Response.json(meta, { status: 201 });
});
