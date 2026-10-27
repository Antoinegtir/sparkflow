import { CreateProjectRequest } from "@/lib/shared";
import { handle, orchestrator } from "@/lib/web/server";

export const dynamic = "force-dynamic";

export const GET = handle(async () => Response.json(await orchestrator().listProjects()));

export const POST = handle(async (req: Request) => {
  const body = CreateProjectRequest.parse(await req.json());
  return Response.json(await orchestrator().createProject(body), { status: 201 });
});
