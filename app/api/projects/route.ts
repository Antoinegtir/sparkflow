import { CreateProjectRequest } from "@/lib/shared";
import { actorOf, requireOwner } from "@/lib/share/actor";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const actor = actorOf(req);
  const all = await orchestrator().listProjects();
  // A guest sees only the project their key opens.
  return Response.json(actor.kind === "guest" ? all.filter((p) => p.id === actor.projectId) : all);
});

export const POST = handle(async (req: Request) => {
  requireOwner(req);
  const body = CreateProjectRequest.parse(await req.json());
  return Response.json(await orchestrator().createProject(body), { status: 201 });
});
